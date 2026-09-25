# Wave 5 Appium harness

This folder contains a small W3C WebDriver client, the strict synthetic API used by Group A, deterministic EPUB fixture generation, and the Group A runner. Appium Server and UiAutomator2 remain external; this harness adds no npm package.

## Requirements

- Node 26 (the project runtime; native fetch is used).
- Existing project dependencies after npm ci --prefer-offline (jszip already comes from the app).
- Android SDK / adb, a booted Pixel_8 API 37 emulator, Appium 3.7.0 and the installed UiAutomator2 8.7.0 driver.
- A debug development APK produced from this short worktree.
- Metro and Appium Server running locally.

## Build and launch

From leitor-epub in the worktree:

~~~~powershell
npm ci --prefer-offline
npx --no-install expo prebuild --platform android
.\android\gradlew.bat :app:assembleDebug -PreactNativeArchitectures=x86_64 --no-daemon
adb devices -l
adb shell getprop sys.boot_completed
adb shell getprop ro.build.version.sdk
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
adb shell pm clear com.example.leitorepub
adb reverse tcp:8081 tcp:8081
adb reverse tcp:18080 tcp:18080
~~~~

Do not pass --clean to Expo prebuild. The runner sends the dev-client deep link to http://127.0.0.1:8081; keep Metro serving the same project in a separate terminal:

~~~~powershell
$env:NODE_OPTIONS='--use-system-ca'
npx expo start --dev-client --host lan --port 8081
~~~~

In another terminal, start the externally installed Appium server (appium --port 4723). Check it first with appium --version and appium driver list --installed.

## Fixtures and Group A run

Run from leitor-epub:

~~~~powershell
node --test .\e2e\appium\helpers.test.mjs
node .\e2e\appium\generate-epub-fixtures.mjs
node .\e2e\appium\group-a.mjs
~~~~

The generator writes reproducible EPUB files under %TEMP%\wave-5h-group-a\fixtures by default. EPUB2 has no cover; EPUB3 and the distinct insertion-failure fixture contain generated covers. All three are pushed to Downloads. The third fixture is imported only for the reversible TEST-019 permission injection: capture the current files/covers mode, remove write bits, attempt the import, and restore the exact original mode in finally before relaunching the app.

The runner expects clean app data. It sends the proved development-client deep link first. If the Expo Dev Client is on its server screen, the runner uses Appium to connect it to the local Metro server through adb reverse. If first-run Dev Menu onboarding appears, it taps Continue and then closes the Dev Menu with Appium Back; this is dev-client startup setup, not a product interaction. The runner saves hierarchy/screenshot evidence at each startup step. It starts and stops the fake API in-process so TEST-011 is exercised with the server actually down. For TEST-019 duplicate observation and TEST-022 local delete, it starts the same fake API as a request monitor; any request other than the three explicit login/sync routes is logged as unexpected and receives HTTP 501.

The fake API contract is intentionally narrow:

- POST /api/auth/login accepts wave5@example.invalid / wave5-password and returns the synthetic wave5-group-a-token.
- GET /api/books returns [].
- GET /api/cards?includeArchived=true returns [].
- Every other request is recorded as UNEXPECTED and returns HTTP 501.

Wave 5H uses the synthetic login only as setup; TEST-004 remains historical and receives no new verdict. The runner drives only TEST-017, TEST-011, TEST-019 and TEST-022. It checks the Reader title and synthetic chapter through the observed hierarchy, then returns with Appium Back. DocumentsUI is a native external activity, so the runner ends Appium before reading its Android UIAutomator hierarchy and tapping the visible fixture card by its bounds, then starts a fresh Appium session after returning to the library. If Android accessibility times out while the EPUB Reader WebView is visible, the runner captures a screenshot, marks the Reader assertion pending visual review, and uses normal Android Back; it does not turn that timeout into a pass and stops before the next TEST ID until the Reader is confirmed. The host Python standard-library sqlite3 connection opens only a copied database with mode=ro; the app database is never edited by the harness.

## Configuration

All values are optional:

- APPIUM_URL (default http://127.0.0.1:4723)
- APPIUM_DEVICE_NAME (default Pixel_8)
- APPIUM_UDID (default emulator-5554)
- APP_PACKAGE (default com.example.leitorepub)
- APP_ACTIVITY (default com.example.leitorepub.MainActivity)
- ANDROID_API_LEVEL (default 37)
- ADB (default adb)
- WAVE5_ARTIFACT_DIR (default %TEMP%\wave-5h-group-a)
- WAVE5_FIXTURE_DIR (default %TEMP%\wave-5h-group-a\fixtures)
- FAKE_API_HOST / FAKE_API_PORT (default 127.0.0.1 / 18080)

No personal machine paths, app secrets or project dependencies are embedded.

## Evidence and limits

The runner preserves screenshots, Appium page sources, Appium session capabilities, fake API request records, logcat excerpts, private filesystem listings and read-only SQLite copies under the artifact directory. Appium Server and Metro logs should be redirected to files outside Git by the operator. Generated android/, APK, fixture binaries, app databases and screenshots are not source artifacts and must not be committed.

If run-as stat/chmod cannot capture and reversibly restrict files/covers, or the mode change does not prevent writes, record BLOCKED_SAFE_INJECTION. Do not replace SQLite files, alter production code, or add a test hook to force that branch. Continue TEST-022 from a verified healthy two-book state; TEST-019 is PARTIAL and Group A remains incomplete.

After evidence capture, stop Metro and Appium, remove only the two adb reverse mappings if desired, and clear only com.example.leitorepub if the test state should be discarded. Do not wipe the AVD or remove Android SDK/AVD packages.
