# macOS WKWebView / WKDownload — test syntetyczny

Owner uruchamia przez hostową kolejkę `run_build_receipt.py` (właściwe flagi
FIFO/`--current-owner` według lokalnego workflow). Komenda payloadu:

```sh
python3 /Volumes/Samsung_SSD/dev/repos/ha-data-exporter/tests/webkit/run.py
```

Driver kompiluje minimalną aplikację AppKit przez `xcrun swiftc`, tworzy `.app`
i uruchamia przez `/usr/bin/open -g -n -W`. Nie uruchamiać poza kolejką buildów.
Wymaga zalogowanej sesji graficznej macOS i narzędzi Xcode. Nie wymaga telefonu,
symulatora, Home Assistanta, danych użytkownika ani istniejącej przeglądarki.

Dla CSV, JSON i YAML test otwiera prawdziwy dialog przyciskiem karty z aktualnego
`ha-data-exporter.js`, czeka na podgląd, zmienia stan eksportowanego syntetycznego
sensora, sprawdza zachowanie podglądu i aktywnego Zapisz, po czym klika Zapisz.
Nie zastępuje `Blob`, URL ani kotwicy. `WKNavigationDelegate` przekształca
`shouldPerformDownload` w `.download`; `WKDownloadDelegate` zapisuje plik do
nowego katalogu i porównuje jego bajty UTF-8 oraz sugerowaną nazwę z podglądem.
Sam komunikat „pobieranie rozpoczęte” nie wystarcza do PASS.

Każdy run pozostawia na SSD własny katalog pod
`/Volumes/Samsung_SSD/dev/agent-data/qa/ha-data-exporter-webkit`:
`manifest.json` (HEAD i SHA-256 rzeczywistego JS), `build.log`, `launch.log`,
`preview.*`, `download.*`, `receipt.json`. Błąd drivera trafia do
`driver-error.json`. Receipt zawiera osobne wyniki formatów i błędy natywne
(`errorDomain`, `errorCode`); błędy nawigacji, także `NSURLErrorDomain/-999`,
zachowuje osobno. Anulowanie nawigacji nie maskuje konieczności zakończenia
rzeczywistego downloadu i porównania bajtów.

Limit kompilacji to 120 s, aplikacji 60 s, oczekiwania `open` 80 s. Cleanup
kończy wyłącznie PID zapisany przez tę instancję, po porównaniu ścieżki procesu.
Artefakty pozostają do przeglądu; cache i pliki tymczasowe są na SSD.

To dowód dla **macOS WKWebView/WKDownload z lokalnym plikiem i syntetycznym HA**.
Nie potwierdza działania wrappera Home Assistant na iOS, jego polityk delegatów,
udostępniania plików ani przyczyny historycznego błędu -999. Kliknięcia wykonuje
JS harnessu, więc nie stanowią testu zaufanego gestu użytkownika.
