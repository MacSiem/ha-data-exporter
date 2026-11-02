#!/usr/bin/env python3
"""Run via the host FIFO build receipt wrapper; all generated files stay on SSD."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import signal
import subprocess
import sys
import tempfile
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-root', type=Path,
                        default=Path('/Volumes/Samsung_SSD/dev/agent-data/qa/ha-data-exporter-webkit'))
    args = parser.parse_args()
    source_dir = Path(__file__).resolve().parent
    repo = source_dir.parent.parent
    output_root = args.output_root.resolve()
    if not output_root.is_relative_to(Path('/Volumes/Samsung_SSD')):
        parser.error('output-root must resolve below /Volumes/Samsung_SSD')
    output_root.mkdir(parents=True, exist_ok=True)
    run = Path(tempfile.mkdtemp(prefix='run-', dir=output_root))
    print(f'Artifacts: {run}', flush=True)
    executable = run / 'DataExporterWKDownload.app/Contents/MacOS/DataExporterWKDownload'
    executable.parent.mkdir(parents=True)
    contents = executable.parent.parent
    cache = run / 'cache'
    cache.mkdir()
    temporary = run / 'tmp'
    temporary.mkdir()
    env = dict(os.environ, TMPDIR=str(temporary) + '/',
               CLANG_MODULE_CACHE_PATH=str(cache), SWIFT_MODULECACHE_PATH=str(cache))
    with (contents / 'Info.plist').open('wb') as handle:
        plistlib.dump({'CFBundlePackageType': 'APPL',
                      'CFBundleExecutable': executable.name,
                      'CFBundleIdentifier': 'dev.macsiem.synthetic-data-exporter-wkdownload',
                      'CFBundleName': 'Synthetic Data Exporter WKDownload',
                      'LSMinimumSystemVersion': '12.0',
                      'NSPrincipalClass': 'NSApplication'}, handle)
    source = (repo / 'ha-data-exporter.js').read_bytes()
    (run / 'ha-data-exporter.js').write_bytes(source)
    (run / 'fixture.js').write_bytes((source_dir / 'fixture.js').read_bytes())
    (run / 'fixture.html').write_text(
        '<!doctype html><meta charset="utf-8"><title>Synthetic WKDownload</title>'
        '<script src="ha-data-exporter.js"></script>'
        '<body><script src="fixture.js"></script></body>', encoding='utf-8')
    manifest = {'sourceSHA256': hashlib.sha256(source).hexdigest(),
                'gitHEAD': subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip(),
                'gitStatus': subprocess.check_output(['git', '-C', str(repo), 'status', '--short'], text=True),
                'createdAtUnix': time.time(), 'runDirectory': str(run)}
    (run / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    try:
        with (run / 'build.log').open('w') as log:
            subprocess.run(['/usr/bin/xcrun', 'swiftc', '-swift-version', '5',
                            '-module-cache-path', str(cache), '-framework', 'AppKit',
                            '-framework', 'WebKit', str(source_dir / 'Harness.swift'),
                            '-o', str(executable)], env=env, stdout=log, stderr=subprocess.STDOUT,
                           check=True, timeout=120)
        with (run / 'launch.log').open('w') as log:
            subprocess.run(['/usr/bin/open', '-g', '-n', '-W', str(contents.parent), '--args', str(run)],
                           env=env, stdout=log, stderr=subprocess.STDOUT,
                           check=True, timeout=80)
        receipt = json.loads((run / 'receipt.json').read_text(encoding='utf-8'))
        print(json.dumps(receipt, indent=2, ensure_ascii=False))
        return 0 if receipt['status'] == 'PASS' else 1
    except (subprocess.SubprocessError, OSError, ValueError) as error:
        failure = {'status': 'FAIL', 'driverError': str(error), 'runDirectory': str(run)}
        (run / 'driver-error.json').write_text(json.dumps(failure, indent=2), encoding='utf-8')
        print(json.dumps(failure), file=sys.stderr)
        return 1
    finally:
        # No pkill/killall: only this invocation's PID, after verifying its executable.
        pid_file = run / 'app.pid'
        if pid_file.exists():
            try:
                pid = int(pid_file.read_text())
                process_path = subprocess.check_output(
                    ['/bin/ps', '-p', str(pid), '-o', 'comm='], text=True).strip()
                if process_path == str(executable):
                    os.kill(pid, signal.SIGTERM)
            except (OSError, ValueError, subprocess.SubprocessError):
                pass


if __name__ == '__main__':
    sys.exit(main())
