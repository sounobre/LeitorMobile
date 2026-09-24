# Mobile E2E Tool Decision

Wave 5A — 2026-09-24. Base: origin/main at b091fef69224c7108eb96ecd9dd6ffb6d9716ad8. Branch: test/wave-5a-mobile-e2e-tool-spike.

## Baseline

| Item | Observação |
|---|---|
| Expo | ~57.0.20; scripts start = expo start --dev-client, android = expo run:android |
| React Native / React | 0.86.3 / 19.2.3 |
| Router | expo-router ~57.0.19; app/_layout.tsx redirects between login and library; index.tsx pushes /reader/[id] |
| Hermes | App config does not override jsEngine. Hermes is the Expo default; runtime not verified without a build. [Expo Hermes](https://docs.expo.dev/guides/using-hermes/) |
| New Architecture | App config does not override newArchEnabled. RN >=0.82 always enables it; runtime not verified without a build. [Expo New Architecture](https://docs.expo.dev/guides/new-architecture/) |
| Native app | expo-dev-client ~57.0.18 and EAS development profile configured; android/ absent; no APK found in this checkout. Application ID com.example.leitorepub. |
| Android config | minSdk 29, compileSdk 36, targetSdk 36 in app.json. expo-sqlite FTS enabled. |
| Native dependencies | expo-sqlite, expo-file-system, expo-document-picker, expo-sharing, react-native-webview, @epubjs-react-native/core and local Expo modules for ML Kit, Google Translate and immersive mode. |
| Windows host | Windows NT 10.0.26200.0; Node v26.8.1; npm 11.19.0; Java 21.0.6. |
| Android SDK | ANDROID_HOME and ANDROID_SDK_ROOT both C:\Users\souno\AppData\Local\Android\Sdk. adb 1.0.41 / platform-tools 37.0.0. Platforms 35, 36, 36.1; build-tools 34, 35, 36, 36.1.0, 36.1.0-rc1; images 34, 36, 37.0. |
| Emulator / device | emulator -list-avds = Pixel_8; its config points to android-37.0/google_apis_playstore_ps16k/x86_64. adb devices and adb devices -l showed no connected target. API 29 platform/image absent. Android 17 = API 37 per [Android SDK table](https://developer.android.com/guide/topics/manifest/uses-sdk-element). |
| SDK inventory limitation | sdkmanager --list_installed attempted to download the replacement Android CLI and was cancelled. Installed directories above were inspected directly; no complete sdkmanager listing is claimed. |

The project uses React Native Paper inputs/buttons and a few named accessibility labels on library and reader controls. No testID was added. Reader text is rendered by @epubjs-react-native/core in react-native-webview; selectors inside that WebView and its selection menu have not been inspected on a device. Import and restore invoke Android Document Picker, backups invoke the share sheet, and reader actions invoke browser/Linking and a local ML Kit module. SQLite and private files require runtime or device-side evidence; screen visibility alone cannot prove their persistence.

The development profile in eas.json is configured, but there is no locally built binary. [Expo local-build documentation](https://docs.expo.dev/guides/local-app-development/) says expo run:android generates android/ by prebuild when absent. This spike did not run it, did not run expo prebuild --clean, and did not generate a native project. Detox additionally requires native Android test/build configuration. A future development build must include the local native modules; installing Expo Go would not prove this app.

## Requirements

Compare the harness against these 22 requirements for this app: (1) Expo 57, (2) RN 0.86, (3) New Architecture, (4) Expo Router, (5) RN Paper/accessibility, (6) Reader WebView, (7) Document Picker, (8) private filesystem, (9) expo-sqlite, (10) share sheet, (11) browser/Linking, (12) ML Kit/native modules, (13) API 29, (14) locally available current stable Android API 37, (15) screenshots, (16) logs, (17) traces/artifacts, (18) reset/reinstall, (19) permissions, (20) network/offline, (21) repository maintenance, (22) future CI.

Status vocabulary: SUPPORTED = explicit documented mechanism for that capability, not a pass on this app; PARTIAL = documented mechanism with a material limitation or app-specific validation outstanding; UNPROVEN = no adequate compatibility proof; BLOCKED = cannot execute in this environment; NOT_SUITABLE = structurally poor fit. All actual app E2E outcomes remain UNPROVEN.

| # / criterion | Maestro | Detox | Appium UiAutomator2 |
|---|---|---|---|
| 1 Expo 57 | PARTIAL — external APK UI runner; build absent | UNPROVEN — Expo integration community-maintained | PARTIAL — APK UI runner; build absent |
| 2 RN 0.86.3 | PARTIAL — native tree must be observed | UNPROVEN — official New Architecture range ends at RN 0.84 | PARTIAL — native tree must be observed |
| 3 New Architecture | PARTIAL — no JS instrumentation, selectors unproved | UNPROVEN — RN 0.86 outside tested range | PARTIAL — Android UI layer, selectors unproved |
| 4 Expo Router | PARTIAL — can tap screens; redirect timing unproved | UNPROVEN — app instrumentation/build unproved | PARTIAL — can tap screens; redirect timing unproved |
| 5 Paper/accessibility | PARTIAL — relies on Android accessibility tree | UNPROVEN — matchers need stable exposed nodes | PARTIAL — UiAutomator2 page source must expose nodes |
| 6 Reader WebView | PARTIAL — native tree may omit content; DevTools hierarchy option | PARTIAL — WebView API exists; Android content-editable action limitation | PARTIAL — NATIVE_APP/WEBVIEW context route documented; actual context/Chromedriver unproved |
| 7 Document Picker | PARTIAL — can drive visible OS UI; fixture/return unproved | UNPROVEN — external system UI outside app synchronization | PARTIAL — Android OS UI reachable; fixture/return unproved |
| 8 Private filesystem | UNPROVEN — indirect UI assertions; adb/run-as would be separate | UNPROVEN — indirect assertions; native build required | UNPROVEN — UI plus external adb/run-as would need validation |
| 9 expo-sqlite | UNPROVEN — indirect UI persistence after restart | UNPROVEN — indirect UI persistence after restart | UNPROVEN — indirect UI plus external app-data inspection would need validation |
| 10 Share sheet | PARTIAL — visible OS UI; device-specific targets | UNPROVEN — external system UI | PARTIAL — OS UI reachability; targets vary |
| 11 Browser/Linking | PARTIAL — OS UI; return unproved | UNPROVEN — leaving app may defeat synchronization | PARTIAL — cross-app native UI; return unproved |
| 12 ML Kit/native | UNPROVEN — only black-box result observable | UNPROVEN — build/runtime integration not demonstrated | UNPROVEN — only black-box result observable |
| 13 API 29 | UNPROVEN — no local image/device | UNPROVEN — no local image/device | SUPPORTED upstream — UiAutomator2 minimum API 26; local target absent |
| 14 API 37 | UNPROVEN — AVD exists, not booted | UNPROVEN — AVD exists, not booted | UNPROVEN — AVD exists, not booted |
| 15 Screenshots | SUPPORTED — takeScreenshot | SUPPORTED — screenshot artifact/device API | SUPPORTED — WebDriver screenshot |
| 16 Logs | SUPPORTED — maestro.log/debug output | SUPPORTED — recorded logs | SUPPORTED — server/driver logs; logcat via adb |
| 17 Traces/artifacts | PARTIAL — commands JSON/JUnit/video, no equivalent native trace proved | PARTIAL — screenshots/video/log; performance recording iOS only | PARTIAL — protocol/server artifacts need explicit collection design |
| 18 Reset/reinstall | PARTIAL — clearState maps to pm clear; reinstall via adb | SUPPORTED — build/install/launch lifecycle, once configured | SUPPORTED — fullReset/noReset/install/activate |
| 19 Permissions | SUPPORTED — launchApp permissions | PARTIAL — device/adb setup needed | SUPPORTED — autoGrantPermissions/changePermissions |
| 20 Network/offline | PARTIAL — external adb/emulator control needed | PARTIAL — external adb/emulator control needed | SUPPORTED with caveat — setConnectivity; real-device limits/session risk |
| 21 Repository maintenance | PARTIAL — CLI and small YAML lane; brittle WebView/OS selectors possible | PARTIAL — native Gradle/test runner and Jest config required | PARTIAL — server, driver, client/capabilities and context lifecycle |
| 22 Future CI | PARTIAL — CLI, APK and emulator needed | PARTIAL — APK + instrumentation APK and emulator; highest build coupling | PARTIAL — server + driver + client + APK + emulator; highest operations load |

For rows 8, 9 and 12, no harness directly proves application semantics without observing state through a permitted interface. For row 14, the installed API 37 AVD cannot count as an executed stable-API check until booted. API 29 needs an additional image/device, independent of tool choice.

## Maestro

**Classification: PARTIAL.** [Windows CLI installation](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli) is documented and Java 21 meets its prerequisite; using the Windows CLI avoids WSL's ADB bridge. It is not installed on PATH here. A development APK could be installed via adb and launched by package ID without adding an npm dependency or modifying production. The local APK/target are absent, so Expo 57/RN 0.86/Router/Paper compatibility is not proven.

The strongest concern is the Reader: [Maestro's known issues](https://docs.maestro.dev/extra-materials/troubleshooting/known-issues) say Android WebView content can be absent from OS accessibility and offer androidWebViewHierarchy: devtools; this app's EPUB WebView and selection menu must be inspected. Picker, share sheet and browser are Android UI surfaces, but fixture injection and app return are untested. [launchApp](https://docs.maestro.dev/reference/commands-available/launchapp) documents clearState and permission controls; [clearState](https://docs.maestro.dev/api-reference/commands/clearstate) maps to Android pm clear. [takeScreenshot](https://docs.maestro.dev/reference/commands-available/takescreenshot) and [reports/artifacts](https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts) document PNG, JUnit, commands JSON and maestro.log. No built-in offline mechanism was established for this app; adb/emulator control would be external. API 29 and API 37 executions are unproven.

Advantages: external CLI, little repository coupling, cross-app visual interaction. Limitations: accessibility/WebView variability, indirect SQLite/private-file evidence, and device-specific OS screens. Practical result: NOT_RUN — no connected target or APK.

## Detox

**Classification: UNPROVEN.** [Official environment guidance](https://wix.github.io/Detox/docs/introduction/environment-setup/) lists RN 0.77–0.84 as fully compatible with New Architecture and explicitly says newer RN is not thoroughly tested; this app uses 0.86.3. Expo integration is community-driven in Detox documentation. This is not proof of incompatibility, but it prevents a safe compatibility claim. [Android project setup](https://wix.github.io/Detox/docs/introduction/project-setup/) requires Gradle and native androidTest changes plus an instrumentation build; android/ does not exist here. This would introduce native-project lifecycle and a repo dev dependency, so Detox was not added merely to test installation.

[How Detox works](https://wix.github.io/Detox/docs/articles/how-detox-works/) documents in-app synchronization; persistent WebView/reader work and ML Kit downloads could need explicit idle/synchronization handling. [WebView API](https://wix.github.io/Detox/docs/api/webviews/) exists, but some Android content-editable actions are unsupported. Document Picker, share sheet and browser leave the instrumented app and are not proven for this app. [Artifacts](https://wix.github.io/Detox/docs/config/artifacts) include screenshot, video and log capture; performance recording and UI hierarchy features noted there are iOS-only. Detox can manage emulator/build variants once native configuration is in place, at high repository and CI maintenance cost. Practical result: NOT_RUN.

## Appium

**Classification: PARTIAL. First candidate for a future practical spike.** The [UiAutomator2 driver](https://github.com/appium/appium-uiautomator2-driver/blob/master/README.md) documents Windows, native/hybrid Android apps, API >=26 in current driver, app install/reset, permissions, screenshots, WebView context options and connectivity control. This gives explicit routes for both RN screens and the Reader WebView plus picker/share/browser system UI without Gradle instrumentation. It does not prove that this exact WebView exposes a usable context, that Chromedriver matches the installed WebView, or that Paper controls have usable selectors. Private SQLite/file inspection would need an authorized debug data path such as adb run-as and must be validated.

Appium 3 plus UiAutomator2 driver 5+ is a documented compatible major pairing; no version was installed or pinned in this spike. A future lane needs an Appium server, driver installation, client library, capabilities (app/udid/automationName), session lifecycle, WebView context handling and artifact collection. This is more operational infrastructure than Maestro and more CI setup than a single CLI. The [driver README](https://github.com/appium/appium-uiautomator2-driver/blob/master/README.md) documents setConnectivity but warns of real-device limitations and possible session loss. API 29 is within the documented minimum but no API 29 image is local; API 37 has not been executed. Practical result: NOT_RUN.

## Decision

Selected: **UNRESOLVED**.

Reason: The device gate is **DEVICE_ENVIRONMENT_BLOCKED** (both adb listings empty). There is also no development APK and no android/ project. The permitted scope excludes automatic native-project generation. None of the three tools installed/opened this app, navigated Expo Router, captured an app screenshot/log, or exercised WebView/Picker. A documented upstream capability is insufficient to mark TOOL_SELECTED.

First candidate: **Appium UiAutomator2**, because its documented native and hybrid contexts plus Android system-UI control directly match the Reader, picker, share and browser boundaries without changing the application build. The hypothesis is conditional on a real run; operational cost is a material drawback. Maestro is deferred as the smaller fallback if Appium setup or context switching is structurally blocked; its WebView visibility limitation must be tested. Detox is deferred because RN 0.86 New Architecture and Expo 57 are outside its explicitly verified combination and it requires native Gradle/instrumentation setup. No downgrade/upgrade of Expo, RN or React is proposed.

Playwright worked for Wave 3 WEB, but is **NOT_SUITABLE** as the primary harness for this native Wave: it cannot adequately drive RN native screens, native SQLite, Document Picker, Share, native Linking or ML Kit. The execution plan already excludes it.

## Proven spike

| Gate | Observation |
|---|---|
| Device/emulator | Pixel_8 API 37 AVD installed; no booted emulator or authorized physical device in adb devices |
| Build | Development profile configured; no APK, no android/; build not executed |
| Tool | None installed or invoked |
| Install / launch | NOT_RUN |
| RN screen / Expo Router navigation | NOT_RUN |
| Screenshot / log or failure artifact | NOT_RUN |
| Reader WebView / Document Picker | NOT_RUN |
| Result | TOOL_DECISION_BLOCKED_DEVICE; no E2E capability claimed |

No Wave 5 TEST ID was executed. No test outcome, device screenshot or tool artifact was invented.

## Remaining gaps

1. Obtain a booted/authorized Android target and a development APK containing the local native modules. Decide separately how to produce it; expo run:android would create android/ when absent, and was intentionally not invoked here. Check whether an existing EAS development artifact can be supplied before generating a local native project.
2. Run the small Appium proof: install/open com.example.leitorepub; inspect the RN login/library tree and navigate one Expo Router route; save screenshot and server/logcat evidence; enter a seeded Reader and enumerate NATIVE_APP/WEBVIEW contexts (or use Document Picker if easier). Do not execute any of the 17 TEST IDs.
3. If Appium cannot interact with this Reader/OS UI for a structural reason, record the failure and try one Maestro flow with androidWebViewHierarchy: devtools. Avoid setting up Detox until its RN 0.86/Expo build compatibility has evidence.
4. Supply an API 29 image/device and repeat the chosen smoke on both API 29 and current local stable API 37. Arrange EPUB fixture, backend/session seed, private-file/SQLite observation, share target and offline controls before Wave 5 implementation.
5. Inspect actual accessibility hierarchy. If a critical control cannot be identified, propose only a few focused accessibilityLabel/testID changes in a separate product task. No labels were added here.

No repository dependency was installed. Maestro can run as external CLI; Appium can run as external server/driver but a reproducible future harness may need a pinned client dev dependency; Detox would need a pinned dev dependency and native Gradle/instrumentation changes. Package files remain untouched. Any installation proposal must name exact versions and package-lock impact before execution.

## Wave 5 execution model

Plan only; all IDs remain NOT_RUN in the matrix/ledger.

| Group | Scope | TEST IDs |
|---|---|---|
| A | session / library / import / delete | TEST-004, TEST-011, TEST-017, TEST-019, TEST-022 |
| B | reader / WebView / progress | TEST-025 |
| C | lookup / card / annotation / bookmark | TEST-030, TEST-034, TEST-036, TEST-038, TEST-043 |
| D | backup / share / restore | TEST-048, TEST-051 |
| E | translation / OS | TEST-032, TEST-033, TEST-052, TEST-053 |

Count: 5 + 1 + 5 + 2 + 4 = 17. Start implementation only after the tool/device decision gate is closed.
