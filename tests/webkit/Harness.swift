import AppKit
import WebKit

@MainActor
final class Harness: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    var downloads: [ObjectIdentifier: WKDownload] = [:]
    var active: [String: Any]?
    var destination: URL?
    var results: [[String: Any]] = []
    var navigationErrors: [[String: Any]] = []
    var formats = ["csv", "json", "yaml"]
    var finished = false
    var watchdog: Timer?
    let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)

    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            try String(ProcessInfo.processInfo.processIdentifier).write(to: directory.appendingPathComponent("app.pid"), atomically: true, encoding: .utf8)
        } catch { finish(error: "Cannot write own PID: \(error)"); return }
        NSApp.setActivationPolicy(.regular)
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(self, name: "harness")
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1000, height: 850), configuration: configuration)
        web.navigationDelegate = self
        window = NSWindow(contentRect: web.frame, styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        window.title = "Synthetic Data Exporter — macOS WKDownload"
        window.contentView = web
        window.orderFront(nil)
        watchdog = Timer.scheduledTimer(withTimeInterval: 60, repeats: false) { [weak self] _ in
            Task { @MainActor in self?.finish(error: "Harness timeout (60s)") }
        }
        web.loadFileURL(directory.appendingPathComponent("fixture.html"), allowingReadAccessTo: directory)
    }

    func evaluate(_ script: String) {
        web.evaluateJavaScript(script) { [weak self] _, error in
            if let error { self?.finish(error: "JavaScript evaluation: \(error)") }
        }
    }

    func next() {
        active = nil; destination = nil
        guard !formats.isEmpty else { finish(); return }
        let format = formats.removeFirst()
        evaluate("void window.prepareFormat('\(format)')")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard !finished, let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "loaded": next()
        case "ready":
            guard active == nil, let format = body["format"] as? String else { finish(error: "Unexpected duplicate ready"); return }
            active = body
            do {
                try (body["preview"] as? String ?? "").write(to: directory.appendingPathComponent("preview.\(format)"), atomically: true, encoding: .utf8)
            } catch { finish(error: "Preview receipt: \(error)"); return }
            evaluate("window.saveReviewed()")
        case "error": finish(error: body["message"] as? String ?? "JavaScript error")
        default: finish(error: "Unknown script message")
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow)
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }
    func retainDownload(_ download: WKDownload) {
        downloads[ObjectIdentifier(download)] = download
        download.delegate = self
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { retainDownload(download) }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { retainDownload(download) }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        guard var current = active, let format = current["format"] as? String, destination == nil else {
            completionHandler(nil); finish(error: "Unexpected download destination request"); return
        }
        let target = directory.appendingPathComponent("download.\(format)")
        destination = target
        current["suggestedFilename"] = suggestedFilename
        current["responseMIMEType"] = response.mimeType ?? ""
        current["destination"] = target.path
        active = current
        completionHandler(target)
    }
    func downloadDidFinish(_ download: WKDownload) {
        downloads.removeValue(forKey: ObjectIdentifier(download))
        guard var current = active, let target = destination, let preview = current.removeValue(forKey: "preview") as? String else {
            finish(error: "Download finished without review"); return
        }
        do {
            let actual = try Data(contentsOf: target)
            let expected = Data(preview.utf8)
            current["bytes"] = actual.count
            current["bytesEqualPreview"] = actual == expected
            current["filenameMatches"] = current["suggestedFilename"] as? String == current["filename"] as? String
            current["status"] = actual == expected && current["filenameMatches"] as? Bool == true ? "PASS" : "FAIL"
            results.append(current)
            guard current["status"] as? String == "PASS" else { finish(error: "Downloaded bytes or filename differ from review"); return }
            next()
        } catch { finish(error: "Reading actual WKDownload destination: \(error)") }
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads.removeValue(forKey: ObjectIdentifier(download))
        var row = active ?? [:]
        row.removeValue(forKey: "preview")
        row["status"] = "FAIL"
        row["errorDomain"] = (error as NSError).domain
        row["errorCode"] = (error as NSError).code
        row["errorMessage"] = error.localizedDescription
        results.append(row)
        finish(error: "WKDownload failed")
    }
    func navigationFailed(_ error: Error) {
        let native = error as NSError
        navigationErrors.append(["errorDomain": native.domain, "errorCode": native.code, "message": native.localizedDescription])
        // A cancellation can accompany conversion into WKDownload; retain the event,
        // but only a completed byte comparison can establish success.
        if native.domain != NSURLErrorDomain || native.code != NSURLErrorCancelled { finish(error: "Navigation failed: \(native)") }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { navigationFailed(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { navigationFailed(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { finish(error: "Web content process terminated") }

    func finish(error: String? = nil) {
        guard !finished else { return }; finished = true
        watchdog?.invalidate()
        var receipt: [String: Any] = ["platform": "macOS WKWebView/WKDownload", "scope": "Synthetic standalone card; does not validate iOS Home Assistant wrapper", "status": error == nil && results.count == 3 ? "PASS" : "FAIL", "formats": results, "navigationErrors": navigationErrors]
        if let error { receipt["error"] = error }
        if var pending = active, !results.contains(where: { ($0["format"] as? String) == (pending["format"] as? String) }) {
            pending.removeValue(forKey: "preview"); pending["status"] = "FAIL"; receipt["pending"] = pending
        }
        do {
            let data = try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted, .sortedKeys])
            try data.write(to: directory.appendingPathComponent("receipt.json"), options: .atomic)
        } catch { fputs("Cannot write receipt: \(error)\n", stderr) }
        NSApp.terminate(nil)
    }
}

@main
struct Runner {
    @MainActor static func main() {
        let app = NSApplication.shared
        let harness = Harness()
        app.delegate = harness
        app.run()
    }
}
