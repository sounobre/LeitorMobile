import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  click, clearElement, createSession, deleteSession, executeMobileCommand, findElement,
  findElements, getPageSource, isDevLauncherHome, isFirstRunDevClientMenu, pressBack, setValue, takeScreenshot, waitFor,
} from './helpers.mjs';
import { createFakeApi } from './fake-api.mjs';
import { generateEpubFixtures } from './generate-epub-fixtures.mjs';

const PACKAGE = process.env.APP_PACKAGE || 'com.example.leitorepub';
const UDID = process.env.APPIUM_UDID || 'emulator-5554';
const API_LEVEL = process.env.ANDROID_API_LEVEL || '37';
const ADB = process.env.ADB || 'adb';
const ARTIFACT_DIR = resolve(process.env.WAVE5_ARTIFACT_DIR ||
  join(process.env.TEMP || tmpdir(), 'wave-5h-group-a'));
const FIXTURE_DIR = resolve(process.env.WAVE5_FIXTURE_DIR ||
  join(process.env.TEMP || tmpdir(), 'wave-5h-group-a', 'fixtures'));
const API_BASE_URL = 'http://127.0.0.1:18080/api';
const LOGIN_EMAIL = 'wave5@example.invalid';
const LOGIN_PASSWORD = 'wave5-password';
const FIXTURE_NAMES = ['wave5-epub2.epub', 'wave5-epub3.epub', 'wave5-insert-failure.epub'];
const TITLES = ['Wave Five EPUB Two', 'Wave Five EPUB Three'];
const FAILURE_TITLE = 'Wave Five Insert Failure';
const CHAPTER_CONTENT = 'This short synthetic chapter exists only for Wave 5 mobile testing.';
const API_SEQUENCE = [
  'POST /api/auth/login',
  'GET /api/books',
  'GET /api/cards?includeArchived=true',
];

function run(command, args, options = {}) {
  const output = spawnSync(command, args, {
    encoding: options.encoding === null ? null : 'utf8',
    maxBuffer: options.maxBuffer || 16 * 1024 * 1024,
    timeout: options.timeoutMs,
    windowsHide: true,
  });
  if (output.error) throw output.error;
  const stdout = options.encoding === null ? output.stdout : String(output.stdout || '');
  const stderr = options.encoding === null ? output.stderr : String(output.stderr || '');
  if (output.status !== 0 && !options.allowNonZero) {
    throw new Error(command + ' ' + args.join(' ') + ' failed (' + output.status + '): ' + stderr);
  }
  return { status: output.status, stdout, stderr };
}

function adb(args, options = {}) {
  return run(ADB, ['-s', UDID, ...args], options);
}

function adbShell(...args) {
  return adb(['shell', ...args]);
}

async function saveJson(filePath, value) {
  await mkdir(resolve(filePath, '..'), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + '\n');
}

async function saveSource(name, source) {
  const filePath = join(ARTIFACT_DIR, 'page-sources', name + '.xml');
  await mkdir(resolve(filePath, '..'), { recursive: true });
  await writeFile(filePath, source);
  return filePath;
}

async function checkpoint(session, name, source) {
  const current = source === undefined ? await getPageSource(session) : source;
  const sourcePath = await saveSource(name, current);
  const screenshotPath = join(ARTIFACT_DIR, 'screenshots', name + '.png');
  await mkdir(resolve(screenshotPath, '..'), { recursive: true });
  await takeScreenshot(session, screenshotPath);
  return { sourcePath, screenshotPath, source: current };
}

function assertHealthy(source, label) {
  assert.equal(source.includes('Maximum update depth exceeded'), false,
    label + ': Maximum update depth exceeded appeared in hierarchy');
  assert.equal(source.includes('Render Error'), false,
    label + ': Render Error appeared in hierarchy');
  assert.equal(source.includes('Text strings must be rendered within a <Text> component.'), false,
    label + ': React Native text-render error appeared in hierarchy');
}

async function saveLogcat(name) {
  const logs = adb(['logcat', '-d', '-v', 'time', 'ReactNativeJS:V', 'ReactNative:V',
    'AndroidRuntime:E', '*:S'], { allowNonZero: true });
  const filePath = join(ARTIFACT_DIR, 'logcat', name + '.txt');
  await mkdir(resolve(filePath, '..'), { recursive: true });
  await writeFile(filePath, logs.stdout + logs.stderr);
  return filePath;
}

async function currentPackage(session) {
  return String(await executeMobileCommand(session, 'mobile: getCurrentPackage') || '');
}

async function waitForPackage(session, name, description = 'foreground ' + name, timeoutMs = 30000) {
  return waitFor(async () => {
    const active = await currentPackage(session);
    return active === name ? active : false;
  }, { description, timeoutMs, intervalMs: 300 });
}

async function waitForSource(session, text, description = 'text ' + text, timeoutMs = 30000) {
  return waitFor(async () => {
    const source = await getPageSource(session);
    return source.includes(text) ? source : false;
  }, { description, timeoutMs, intervalMs: 250 });
}

async function findVisibleText(session, text) {
  try {
    return await findElement(session, 'accessibility id', text);
  } catch {
    return findElement(session, '-android uiautomator',
      'new UiSelector().text("' + text.replaceAll('"', '\\"') + '")');
  }
}

async function clickText(session, text) {
  const element = await findVisibleText(session, text);
  await click(session, element);
  return { text, element };
}

async function ensurePreflight() {
  const devices = adb(['devices', '-l']).stdout;
  assert.match(devices, new RegExp(UDID + '\\s+device'));
  const boot = adbShell('getprop', 'sys.boot_completed').stdout.trim();
  const sdk = adbShell('getprop', 'ro.build.version.sdk').stdout.trim();
  assert.equal(boot, '1');
  assert.equal(sdk, API_LEVEL);
  const metro = await fetch('http://127.0.0.1:8081/status');
  assert.equal(metro.status, 200);
  const appium = await fetch((process.env.APPIUM_URL || 'http://127.0.0.1:4723') + '/status');
  assert.equal(appium.status, 200);
  return {
    target: UDID,
    api: sdk,
    bootCompleted: boot,
    devices,
    metroStatus: await metro.text(),
    appiumStatus: await appium.text(),
  };
}

async function appAlive() {
  return Boolean(adb(['shell', 'pidof', PACKAGE], { allowNonZero: true }).stdout.trim());
}

async function stopAndResume(session, expectedText) {
  adbShell('am', 'force-stop', PACKAGE);
  await waitFor(async () => !(await appAlive()), {
    description: PACKAGE + ' process stopped',
    timeoutMs: 15000,
    intervalMs: 300,
  });
  try {
    await executeMobileCommand(session, 'mobile: activateApp', { appId: PACKAGE });
  } catch {
    adbShell('am', 'start', '-n', PACKAGE + '/.MainActivity');
  }
  await waitForPackage(session, PACKAGE, PACKAGE + ' foreground after restart');
  const source = await waitForSource(session, expectedText,
    'restarted app shows ' + expectedText, 45000);
  assertHealthy(source, 'app restart');
  return source;
}

async function privateFileListing() {
  const text = adb(['shell', 'run-as', PACKAGE, 'find', 'files', '-type', 'f'],
    { allowNonZero: true }).stdout;
  const all = text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).sort();
  return {
    all,
    books: all.filter((value) => value.startsWith('files/books/') && value.endsWith('.epub')),
    covers: all.filter((value) => value.startsWith('files/covers/')),
  };
}

async function copyPrivateFile(devicePath, localPath) {
  const data = run(ADB, ['-s', UDID, 'exec-out', 'run-as', PACKAGE, 'cat', devicePath], {
    encoding: null, allowNonZero: true, maxBuffer: 16 * 1024 * 1024,
  });
  if (data.status !== 0 || !data.stdout?.length) return false;
  await writeFile(localPath, data.stdout);
  return true;
}

const PY_SQLITE = [
  'import json, sqlite3, sys',
  'from pathlib import Path',
  'path = Path(sys.argv[1]).resolve()',
  'db = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)',
  'db.row_factory = sqlite3.Row',
  'tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type=\'table\'")}',
  'integrity_check = db.execute("PRAGMA integrity_check").fetchone()[0]',
  'session = []',
  'books = []',
  'if "sync_session" in tables:',
  ' session = [dict(row) for row in db.execute("SELECT email, api_base_url FROM sync_session ORDER BY id")]',
  'if "books" in tables:',
  ' books = [dict(row) for row in db.execute("SELECT id, title, author, file_hash, file_uri, cover_uri, imported_at, last_opened_at FROM books ORDER BY COALESCE(last_opened_at, imported_at) DESC")]',
  'print(json.dumps({"integrityCheck": integrity_check, "session": session, "books": books, "bookCount": len(books)}, ensure_ascii=False))',
  'db.close()',
].join('\n');

function sqliteRows(localPath) {
  for (const attempt of [
    ['python', ['-c', PY_SQLITE, localPath]],
    ['py', ['-3', '-c', PY_SQLITE, localPath]],
  ]) {
    try {
      const output = run(attempt[0], attempt[1], { allowNonZero: true, maxBuffer: 4 * 1024 * 1024 });
      if (output.status === 0) return JSON.parse(output.stdout.trim());
    } catch {}
  }
  return { unavailable: 'Host Python standard-library sqlite3 was unavailable.' };
}

function privateFileRelativePath(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('file:')) return null;
  try {
    const pathname = decodeURIComponent(new URL(uri).pathname);
    const marker = '/files/';
    const index = pathname.lastIndexOf(marker);
    return index < 0 ? null : pathname.slice(index + 1);
  } catch {
    return null;
  }
}

function assertSnapshotBooks(snapshot, expectedCount, label) {
  assert.equal(snapshot.sqlite?.integrityCheck, 'ok', label + ': SQLite integrity_check');
  assert.ok(Array.isArray(snapshot.sqlite?.books), label + ': read-only SQLite books unavailable');
  assert.equal(snapshot.sqlite.books.length, expectedCount, label + ': SQLite book count');
  assert.equal(snapshot.files.books.length, expectedCount, label + ': private EPUB count');
  for (const row of snapshot.sqlite.books) {
    assert.ok(row.file_hash, label + ': file_hash missing for ' + row.title);
    const bookPath = privateFileRelativePath(row.file_uri);
    assert.ok(bookPath, label + ': file_uri is not a private local file for ' + row.title);
    assert.ok(snapshot.files.books.includes(bookPath),
      label + ': SQLite file_uri does not map to a listed private EPUB for ' + row.title);
    if (row.cover_uri) {
      const coverPath = privateFileRelativePath(row.cover_uri);
      assert.ok(coverPath, label + ': cover_uri is not a private local file for ' + row.title);
      assert.ok(snapshot.files.covers.includes(coverPath),
        label + ': SQLite cover_uri does not map to a listed private cover for ' + row.title);
    }
  }
}

function hierarchyTextValues(source) {
  return [...String(source || '').matchAll(/(?:text|content-desc)="([^"]*)"/g)]
    .map((match) => match[1]
      .replaceAll('&quot;', '"')
      .replaceAll('&apos;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&'))
    .filter(Boolean);
}

async function directoryPermissionState(relativePath) {
  const stat = adb(['shell', 'run-as', PACKAGE, 'stat', '-c', '%a', relativePath],
    { allowNonZero: true });
  const listing = adb(['shell', 'run-as', PACKAGE, 'ls', '-ld', relativePath],
    { allowNonZero: true });
  const rawMode = stat.stdout.trim().split(/\r?\n/).at(-1) || '';
  const mode = stat.status === 0 && /^[0-7]{3,4}$/.test(rawMode) ? rawMode : null;
  return {
    path: relativePath,
    mode,
    statStatus: stat.status,
    statOutput: stat.stdout.trim(),
    statError: stat.stderr.trim(),
    listingStatus: listing.status,
    listing: listing.stdout.trim(),
    listingError: listing.stderr.trim(),
    available: Boolean(mode),
  };
}

function chmodPrivateDirectory(relativePath, mode) {
  return adb(['shell', 'run-as', PACKAGE, 'chmod', mode, relativePath],
    { allowNonZero: true });
}

async function forceStopPackage() {
  adbShell('am', 'force-stop', PACKAGE);
  await waitFor(async () => !(await appAlive()), {
    description: PACKAGE + ' process stopped',
    timeoutMs: 15000,
    intervalMs: 300,
  });
}

async function assertNoRuntimeErrors(name) {
  const logcat = adb(['logcat', '-d', '-v', 'time', 'ReactNativeJS:V', 'ReactNative:V',
    'AndroidRuntime:E', '*:S'], { allowNonZero: true }).stdout;
  let metro = '';
  const metroPath = process.env.WAVE5_METRO_LOG || null;
  if (metroPath) {
    try {
      metro = await readFile(metroPath, 'utf8');
    } catch {}
  }
  const patterns = [
    ['Maximum update depth exceeded', /Maximum update depth exceeded/i],
    ['Text strings must be rendered', /Text strings must be rendered/i],
    ['Render Error', /\bRender Error\b/i],
    ['FATAL EXCEPTION', /FATAL EXCEPTION/i],
  ];
  const sources = [{ name: 'logcat', text: logcat }, { name: 'metro', text: metro }];
  const findings = [];
  for (const source of sources) {
    const lines = source.text.split(/\r?\n/);
    for (const [label, pattern] of patterns) {
      for (const line of lines) {
        if (pattern.test(line)) findings.push({ source: source.name, label, line });
      }
    }
  }
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const logPath = join(ARTIFACT_DIR, 'runtime', safeName + '.txt');
  await mkdir(resolve(logPath, '..'), { recursive: true });
  await writeFile(logPath, '=== LOGCAT ===\n' + logcat + '\n=== METRO ===\n' + metro);
  const evidence = { name, logPath, metroPath, findings };
  await saveJson(join(ARTIFACT_DIR, 'runtime', safeName + '.json'), evidence);
  assert.equal(findings.length, 0, name + ': runtime errors found: ' + JSON.stringify(findings));
  return evidence;
}

async function captureLocalSnapshot(session, name, expectedText, options = {}) {
  adbShell('am', 'force-stop', PACKAGE);
  await waitFor(async () => !(await appAlive()), {
    description: 'app stopped before read-only SQLite/filesystem capture',
    timeoutMs: 15000,
    intervalMs: 300,
  });
  const files = await privateFileListing();
  const directory = join(ARTIFACT_DIR, 'sqlite', name);
  await mkdir(directory, { recursive: true });
  const deviceDbFiles = adb(['shell', 'run-as', PACKAGE, 'find', 'files/SQLite', '-type', 'f'],
    { allowNonZero: true }).stdout.split(/\r?\n/).map((value) => value.trim());
  const copyList = [
    'files/SQLite/leitor-epub.db',
    'files/SQLite/leitor-epub.db-wal',
    'files/SQLite/leitor-epub.db-shm',
  ];
  const copied = [];
  for (const path of copyList) {
    if (!deviceDbFiles.includes(path)) continue;
    const local = join(directory, basename(path));
    if (await copyPrivateFile(path, local)) copied.push(local);
  }
  const database = join(directory, 'leitor-epub.db');
  const sqlite = copied.includes(database)
    ? sqliteRows(database)
    : { unavailable: 'leitor-epub.db was not available for adb run-as read-only copying.' };
  const snapshot = { files, sqlite, copiedDatabaseFiles: copied };
  await saveJson(join(directory, 'snapshot.json'), snapshot);
  await saveJson(join(ARTIFACT_DIR, 'filesystem', name + '.json'), files);
  if (options.resume !== false) await stopAndResume(session, expectedText);
  return snapshot;
}

async function pushFixture(path, filename) {
  adbShell('mkdir', '-p', '/sdcard/Download');
  adb(['push', path, '/sdcard/Download/' + filename]);
  const listing = adbShell('ls', '-l', '/sdcard/Download/' + filename).stdout;
  assert.ok(listing.includes(filename));
  return listing.trim();
}

function clickableDeviceTarget(xml, text) {
  const stack = [];
  for (const match of String(xml).matchAll(/<\/?[A-Za-z_][\w.:-]*\b[^>]*>/g)) {
    const token = match[0];
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    const attributes = Object.fromEntries([...token.matchAll(/([\w:-]+)="([^"]*)"/g)]
      .map((attribute) => [attribute[1], attribute[2]]));
    stack.push(attributes);
    if (attributes.text === text || attributes['content-desc'] === text) {
      const target = [...stack].reverse().find((node) =>
        node.clickable === 'true' && node.bounds);
      if (target) {
        const coordinates = target.bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
        if (coordinates) {
          const [, left, top, right, bottom] = coordinates;
          return {
            text,
            className: target.class,
            resourceId: target['resource-id'] || null,
            bounds: target.bounds,
            x: Math.floor((Number(left) + Number(right)) / 2),
            y: Math.floor((Number(top) + Number(bottom)) / 2),
          };
        }
      }
    }
    if (token.endsWith('/>')) stack.pop();
  }
  return null;
}

async function dumpDeviceHierarchy(name, { timeoutMs = 45000 } = {}) {
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const devicePath = '/sdcard/wave5h-' + safeName + '.xml';
  let source = '';
  try {
    const dump = adb(['shell', 'uiautomator', 'dump', devicePath], { timeoutMs });
    assert.equal(dump.status, 0, 'Android UI hierarchy dump command failed');
    source = adb(['shell', 'cat', devicePath]).stdout;
  } finally {
    adb(['shell', 'rm', '-f', devicePath], { allowNonZero: true });
  }
  assert.ok(source.includes('<hierarchy'), 'Android UI hierarchy dump is unavailable');
  return source;
}

async function captureDeviceScreenshot(name) {
  const screenshotPath = join(ARTIFACT_DIR, 'screenshots', name + '.png');
  await mkdir(resolve(screenshotPath, '..'), { recursive: true });
  const screenshot = run(ADB, ['-s', UDID, 'exec-out', 'screencap', '-p'], {
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(screenshot.status, 0, 'adb screencap failed for ' + name);
  await writeFile(screenshotPath, screenshot.stdout);
  return { screenshotPath };
}

async function checkpointDeviceUi(name, source) {
  const sourcePath = await saveSource(name, source);
  const screenshot = await captureDeviceScreenshot(name);
  return { sourcePath, ...screenshot, source };
}

async function tapDeviceTarget(target) {
  assert.ok(target, 'Android picker target is missing');
  adbShell('input', 'tap', String(target.x), String(target.y));
  return { ...target, input: 'adb shell input tap' };
}

function deviceForegroundPackage() {
  const activities = adb(['shell', 'dumpsys', 'activity', 'activities']).stdout;
  const match = activities.match(/topResumedActivity=[\s\S]*?\bu\d+\s+([A-Za-z0-9_.]+)\//);
  return match?.[1] || '';
}

async function waitForDevicePackage(packageName, description, timeoutMs = 30000) {
  return waitFor(() => {
    const foreground = deviceForegroundPackage();
    return foreground === packageName ? foreground : false;
  }, { description, timeoutMs, intervalMs: 300 });
}

async function restoreAppiumSession(session) {
  const replacement = await createSession();
  session.id = replacement.id;
  session.capabilities = replacement.capabilities;
}

async function selectFromPicker(session, filename, title, checkpointPrefix, options = {}) {
  const importControl = await findElement(session, 'accessibility id', 'Importar livro EPUB');
  await click(session, importControl);
  await waitFor(async () => {
    const foreground = await currentPackage(session);
    return foreground.includes('documentsui') || foreground.includes('DocumentsUI') ? foreground : false;
  }, { description: 'DocumentsUI launched by product import control', timeoutMs: 30000 });

  await deleteSession(session);
  let source = await dumpDeviceHierarchy(checkpointPrefix + '-picker-open');
  assertHealthy(source, checkpointPrefix + ' picker');
  await checkpointDeviceUi(checkpointPrefix + '-picker-open', source);
  const pickerActions = [];
  let pickerTarget = clickableDeviceTarget(source, filename);
  if (!pickerTarget) {
    const roots = clickableDeviceTarget(source, 'Show roots');
    if (roots) {
      pickerActions.push(await tapDeviceTarget(roots));
      source = await dumpDeviceHierarchy(checkpointPrefix + '-picker-roots');
      await checkpointDeviceUi(checkpointPrefix + '-picker-roots', source);
      const downloads = clickableDeviceTarget(source, 'Downloads');
      assert.ok(downloads, 'DocumentsUI roots did not expose Downloads');
      pickerActions.push(await tapDeviceTarget(downloads));
      source = await dumpDeviceHierarchy(checkpointPrefix + '-picker-downloads');
    }
    pickerTarget = clickableDeviceTarget(source, filename);
  }
  assert.ok(pickerTarget, 'DocumentsUI hierarchy does not expose fixture ' + filename);
  const pickerEvidence = await checkpointDeviceUi(checkpointPrefix + '-picker-file', source);
  pickerActions.push(await tapDeviceTarget(pickerTarget));
  await saveJson(join(ARTIFACT_DIR, 'picker-interactions', checkpointPrefix + '.json'), {
    method: 'uiautomator hierarchy and visible clickable card bounds',
    actions: pickerActions,
  });

  const foreground = await waitForDevicePackage(PACKAGE,
    'return from DocumentsUI to product after selecting ' + filename, 60000);
  let outcome;
  try {
    outcome = await waitFor(async () => {
      const current = await dumpDeviceHierarchy(
        checkpointPrefix + '-import-outcome', { timeoutMs: 12000 });
      if (current.includes(title) && current.includes(CHAPTER_CONTENT)) {
        return { route: 'reader', source: current };
      }
      if (current.includes('Buscar na biblioteca') && current.includes('Leitor EPUB')) {
        if (/content-desc="busy"/.test(current)) return false;
        if (options.expectFailure || options.allowLibraryResult) {
          return { route: 'library', source: current };
        }
      }
      return false;
    }, {
      description: 'Reader or expected library result after selecting ' + filename,
      timeoutMs: 65000,
      intervalMs: 500,
    });
  } catch (error) {
    if (options.expectFailure) throw error;
    const screenshotEvidence = await captureDeviceScreenshot(
      checkpointPrefix + '-reader-accessibility-fallback');
    const diagnosticPath = join(ARTIFACT_DIR, 'runtime',
      checkpointPrefix + '-reader-accessibility-fallback.json');
    await saveJson(diagnosticPath, {
      outcome: 'SCREENSHOT_PENDING_VISUAL_REVIEW',
      reason: error.message,
      foregroundPackage: foreground,
      screenshot: screenshotEvidence.screenshotPath,
    });
    outcome = {
      route: 'reader-screenshot-review',
      source: null,
      accessibilityUnavailable: error.message,
      screenshotEvidence,
    };
  }
  source = outcome.source || '';
  if (source) assertHealthy(source, checkpointPrefix + ' import outcome');

  let readerEvidence = null;
  let libraryEvidence = null;
  let readerTitleObserved = false;
  let readerContentObserved = false;
  if (outcome.route === 'reader' || outcome.route === 'reader-screenshot-review') {
    if (source) {
      assert.ok(source.includes(title), checkpointPrefix + ': Reader title missing');
      assert.ok(source.includes(CHAPTER_CONTENT), checkpointPrefix + ': Reader content missing');
      readerTitleObserved = true;
      readerContentObserved = true;
      readerEvidence = await checkpointDeviceUi(checkpointPrefix + '-reader-route', source);
    } else {
      readerEvidence = outcome.screenshotEvidence;
    }
    adbShell('input', 'keyevent', '4');
    source = await waitFor(async () => {
      const current = await dumpDeviceHierarchy(checkpointPrefix + '-library-return');
      return current.includes('Buscar na biblioteca') && current.includes(title) ? current : false;
    }, { description: 'library restored by normal Android Back', timeoutMs: 30000, intervalMs: 500 });
    assertHealthy(source, checkpointPrefix + ' library return');
    libraryEvidence = await checkpointDeviceUi(checkpointPrefix + '-library-return', source);
  } else {
    libraryEvidence = await checkpointDeviceUi(
      checkpointPrefix + (options.expectFailure ? '-import-error' : '-library-result'), source);
  }

  await restoreAppiumSession(session);
  const appiumLibrary = await waitForSource(session, 'Buscar na biblioteca',
    'Appium reattached to product library after native picker', 30000);
  assertHealthy(appiumLibrary, checkpointPrefix + ' Appium library reattachment');
  const appiumLibraryEvidence = await checkpoint(session,
    checkpointPrefix + '-appium-library-reattached', appiumLibrary);

  if (outcome.route === 'library') {
    const baselineTexts = new Set(hierarchyTextValues(options.baselineSource));
    const newTexts = hierarchyTextValues(source).filter((value) => !baselineTexts.has(value));
    if (options.expectFailure) {
      return {
        foreground,
        route: 'library',
        returnedToLibrary: true,
        failureUiTextCandidates: newTexts,
        evidence: libraryEvidence,
        appiumLibraryEvidence,
        pickerEvidence,
        pickerActions,
      };
    }
    if (options.allowLibraryResult) {
      return {
        foreground,
        route: 'library',
        returnedToLibrary: true,
        duplicateMessageObserved: source.includes('Este livro já está na biblioteca.'),
        messageTextCandidates: newTexts,
        evidence: libraryEvidence,
        appiumLibraryEvidence,
        pickerEvidence,
        pickerActions,
      };
    }
    throw new Error('Selecting ' + filename + ' returned to the library instead of opening ' + title);
  }

  return {
    foreground,
    route: 'reader',
    readerTitleObserved: readerTitleObserved ? true : 'PENDING_VISUAL_REVIEW',
    readerContentObserved: readerContentObserved ? true : 'PENDING_VISUAL_REVIEW',
    returnedToLibrary: true,
    readerEvidence,
    libraryEvidence,
    appiumLibraryEvidence,
    pickerEvidence,
    pickerActions,
    failureExpected: options.expectFailure || false,
  };
}
async function observeStartupScreen(session, description) {
  return waitFor(async () => {
    const source = await getPageSource(session);
    if (source.includes('Entrar no Leitor')) return { screen: 'product-login', source };
    if (isFirstRunDevClientMenu(source)) return { screen: 'first-run-dev-menu', source };
    if (isDevLauncherHome(source)) return { screen: 'dev-launcher-home', source };
    if (source.includes('Maximum update depth exceeded') || source.includes('Render Error')) {
      return { screen: 'runtime-error', source };
    }
    return false;
  }, { description, timeoutMs: 45000, intervalMs: 300 });
}

async function waitForProductStartup(session, description) {
  return waitFor(async () => {
    const source = await getPageSource(session);
    if (source.includes('Entrar no Leitor')) return { screen: 'product-login', source };
    if (isFirstRunDevClientMenu(source)) return { screen: 'first-run-dev-menu', source };
    if (source.includes('Maximum update depth exceeded') || source.includes('Render Error')) {
      return { screen: 'runtime-error', source };
    }
    return false;
  }, { description, timeoutMs: 45000, intervalMs: 300 });
}

async function loadProductLogin(session, deepLink) {
  let startup = await observeStartupScreen(session,
    'product login, Dev Client server screen, or known first-run screen');
  if (startup.screen === 'runtime-error') {
    await checkpoint(session, 'startup-runtime-error', startup.source);
    await saveLogcat('startup-runtime-error');
    throw new Error('React Native runtime error before login: ' + startup.source);
  }
  if (startup.screen === 'dev-launcher-home') {
    await checkpoint(session, 'startup-dev-client-server-screen', startup.source);
    const urlField = await findElement(session, 'class name', 'android.widget.EditText');
    await clearElement(session, urlField);
    await setValue(session, urlField, '127.0.0.1:8081');
    const configuredSource = await getPageSource(session);
    assert.ok(configuredSource.includes('127.0.0.1:8081'),
      'Dev Client server field should show the local Metro address');
    await checkpoint(session, 'startup-dev-client-server-address', configuredSource);
    await clickText(session, 'Connect');
    startup = await waitForProductStartup(session,
      'product bundle or first-run Dev Menu after local Metro connection');
    if (startup.screen === 'runtime-error') {
      await checkpoint(session, 'startup-runtime-error-after-connect', startup.source);
      await saveLogcat('startup-runtime-error-after-connect');
      throw new Error('React Native runtime error after local Metro connection: ' + startup.source);
    }
  }
  if (startup.screen === 'first-run-dev-menu') {
    await checkpoint(session, 'startup-first-run-dev-menu', startup.source);
    await clickText(session, 'Continue');
    const developerMenu = await waitFor(async () => {
      const source = await getPageSource(session);
      return source.includes('Go home') && source.includes('TOOLS') ? source : false;
    }, { description: 'Dev Menu after first-run Continue', timeoutMs: 15000, intervalMs: 250 });
    await checkpoint(session, 'startup-dev-menu-after-continue', developerMenu);
    await pressBack(session);
    startup = await waitForProductStartup(session,
      'product login after closing first-run Dev Menu');
    if (startup.screen === 'runtime-error') {
      await checkpoint(session, 'startup-runtime-error-after-onboarding', startup.source);
      await saveLogcat('startup-runtime-error-after-onboarding');
      throw new Error('React Native runtime error after first-run Dev Menu: ' + startup.source);
    }
  }
  if (startup.screen !== 'product-login') {
    const evidence = await checkpoint(session, 'startup-unexpected-screen', await getPageSource(session));
    throw new Error('Expected login after development-client startup; observed ' + startup.screen +
      ' (hierarchy: ' + evidence.sourcePath + ')');
  }
  return startup.source;
}
async function enterLogin(session, initialSource) {
  const initial = initialSource || await waitForSource(session, 'Entrar no Leitor', 'login UI', 60000);
  assertHealthy(initial, 'login UI');
  await checkpoint(session, 'login-initial', initial);
  const fields = await findElements(session, 'class name', 'android.widget.EditText');
  assert.ok(fields.length >= 3, 'expected E-mail, Senha, Endereço da API edit controls');
  await clearElement(session, fields[0]);
  await setValue(session, fields[0], LOGIN_EMAIL);
  await clearElement(session, fields[1]);
  await setValue(session, fields[1], LOGIN_PASSWORD);
  await clearElement(session, fields[2]);
  await setValue(session, fields[2], API_BASE_URL);
  const filled = await getPageSource(session);
  assert.ok(filled.includes(LOGIN_EMAIL));
  assert.ok(filled.includes(API_BASE_URL));
  await checkpoint(session, 'login-filled', filled);
  const readyToSubmit = await getPageSource(session);
  assert.ok(readyToSubmit.includes('Entrar no Leitor'),
    'login form should remain visible after hiding the keyboard');
  await checkpoint(session, 'login-ready-to-submit', readyToSubmit);
  const submitButtons = await findElements(session, 'class name', 'android.widget.Button');
  assert.equal(submitButtons.length, 1,
    'expected one observed Android button for Entrar e sincronizar');
  await click(session, submitButtons[0]);
  return waitForSource(session, 'Leitor EPUB', 'library after synthetic login', 60000);
}

async function observedLoginSync(fake) {
  const observed = [];
  for (const expected of API_SEQUENCE) {
    const split = expected.indexOf(' ');
    const item = await fake.waitForRequest(
      (entry) => entry.method === expected.slice(0, split) && entry.url === expected.slice(split + 1),
      expected,
      25000,
    );
    observed.push(item.method + ' ' + item.url);
  }
  assert.deepEqual(observed, API_SEQUENCE);
  assert.deepEqual(fake.unexpected, []);
  return observed;
}

async function searchLibrary(session, query, required, forbidden, name) {
  const search = await findElement(session, 'accessibility id', 'Buscar na biblioteca');
  await clearElement(session, search);
  await setValue(session, search, query);
  let source = await waitFor(async () => {
    const value = await getPageSource(session);
    return value.includes(required) && (!forbidden || !value.includes(forbidden)) ? value : false;
  }, { description: 'library filter ' + query, timeoutMs: 20000 });
  await pressBack(session);
  source = await getPageSource(session);
  assertHealthy(source, 'filter ' + query);
  await checkpoint(session, name, source);
  return source;
}

function bookIndex(snapshot, title) {
  const rows = snapshot?.sqlite?.books;
  if (!Array.isArray(rows)) throw new Error('Read-only SQLite is required to map the exact book menu.');
  const index = rows.findIndex((row) => row.title === title);
  if (index < 0) throw new Error('SQLite book row missing: ' + title);
  return index;
}

async function openDeleteDialog(session, title, snapshot) {
  const source = await getPageSource(session);
  assert.ok(source.includes(title));
  const menus = await findElements(session, 'accessibility id', 'Opcoes do livro');
  const index = bookIndex(snapshot, title);
  assert.equal(menus.length, snapshot.sqlite.books.length, 'expected one options control for each book');
  const uiOrder = snapshot.sqlite.books
    .map((row) => ({ title: row.title, pos: source.indexOf(row.title) }))
    .sort((left, right) => left.pos - right.pos)
    .map((row) => row.title);
  assert.deepEqual(uiOrder, snapshot.sqlite.books.map((row) => row.title),
    'visible book order differs from SQLite library order');
  await click(session, menus[index]);
  await click(session, await waitFor(() => findVisibleText(session, 'Excluir livro'), {
    description: 'book options menu item Excluir livro', timeoutMs: 15000,
  }));
  const dialog = await waitFor(async () => {
    const current = await getPageSource(session);
    return current.includes('Cancelar') && current.includes('Remover') ? current : false;
  }, { description: 'native delete confirmation Alert', timeoutMs: 15000 });
  await saveSource('delete-alert-' + title.replaceAll(' ', '-'), dialog);
  return dialog;
}

async function deleteBook(session, title, buttonText, snapshot) {
  await openDeleteDialog(session, title, snapshot);
  await click(session, await waitFor(() => findVisibleText(session, buttonText), {
    description: 'delete dialog button ' + buttonText, timeoutMs: 15000,
  }));
}

async function waitForLibrary(session, title) {
  await waitForPackage(session, PACKAGE, 'product app foreground');
  return waitFor(async () => {
    const source = await getPageSource(session);
    const target = title ? source.includes(title) : source.includes('Sua biblioteca está vazia');
    return source.includes('Buscar na biblioteca') && target ? source : false;
  }, { description: title || 'empty library state', timeoutMs: 45000 });
}

async function runGroupA() {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const environment = await ensurePreflight();
  const result = {
    wave: '5H',
    group: 'A',
    environment: { udid: UDID, api: API_LEVEL, appPackage: PACKAGE },
    artifacts: ARTIFACT_DIR,
    fixtures: null,
    setup: {},
    tests: {},
  };
  let session;
  let currentTest = 'setup-login';
  const fake = createFakeApi();
  try {
    result.fixtures = await generateEpubFixtures(FIXTURE_DIR);
    await saveJson(join(ARTIFACT_DIR, 'environment.json'), environment);
    result.fixtureDownloads = [];
    for (const filename of FIXTURE_NAMES) {
      result.fixtureDownloads.push(await pushFixture(join(FIXTURE_DIR, filename), filename));
    }
    adb(['reverse', 'tcp:8081', 'tcp:8081']);
    adb(['reverse', 'tcp:18080', 'tcp:18080']);
    await fake.listen();

    session = await createSession();
    result.appiumSession = { id: session.id, capabilities: session.capabilities };
    const loginSource = await loadProductLogin(session);
    let library = await enterLogin(session, loginSource);
    assertHealthy(library, 'library after synthetic setup login');
    assert.ok(library.includes('Sua biblioteca está vazia'),
      'synthetic setup login should begin with an empty library');
    assert.equal(library.includes(TITLES[0]), false);
    assert.equal(library.includes(TITLES[1]), false);
    const apiSequence = await observedLoginSync(fake);
    const setupEvidence = await checkpoint(session, 'setup-synthetic-login-empty-library', library);
    result.setup = {
      syntheticLoginUsed: true,
      verdictChanged: false,
      libraryEmpty: true,
      initialApiSequence: apiSequence,
      evidence: setupEvidence,
    };
    result.runtimeBeforeE2e = await assertNoRuntimeErrors('before-test-017');

    currentTest = 'TEST-017';
    const importEpub2 = await selectFromPicker(session, FIXTURE_NAMES[0], TITLES[0],
      'test-017-epub2');
    const epub2ReaderConfirmed = importEpub2.readerTitleObserved === true &&
      importEpub2.readerContentObserved === true;
    result.tests['TEST-017'] = {
      epub2: {
        picker: true,
        readerTitle: importEpub2.readerTitleObserved,
        readerContent: importEpub2.readerContentObserved,
        evidence: importEpub2.readerEvidence,
      },
      status: epub2ReaderConfirmed ? 'READER_CONFIRMED_CONTINUE' : 'BLOCKED_VISUAL_REVIEW',
    };
    if (!epub2ReaderConfirmed) {
      throw new Error('TEST-017: EPUB2 Reader title/content were not confirmed; stop before EPUB3 and all later TEST IDs.');
    }
    const importEpub3 = await selectFromPicker(session, FIXTURE_NAMES[1], TITLES[1],
      'test-017-epub3');
    const imports = await captureLocalSnapshot(session, 'test-017-imported-books', 'Leitor EPUB');
    assertSnapshotBooks(imports, 2, 'TEST-017');
    assert.equal(imports.files.covers.length, 1, 'TEST-017: exactly one private cover');
    library = await waitForLibrary(session, TITLES[0]);
    assert.ok(library.includes(TITLES[1]), 'TEST-017: both imported books visible');
    const importedRows = imports.sqlite.books;
    const epub2 = importedRows.find((row) => row.title === TITLES[0]);
    const epub3 = importedRows.find((row) => row.title === TITLES[1]);
    assert.ok(epub2 && epub3, 'TEST-017: SQLite rows correlate to both fixture titles');
    assert.equal(epub2.cover_uri, null, 'TEST-017: EPUB2 has no cover_uri');
    assert.ok(epub3.cover_uri, 'TEST-017: EPUB3 has a cover_uri');
    assert.ok(privateFileRelativePath(epub2.file_uri));
    assert.ok(privateFileRelativePath(epub3.file_uri));
    assert.ok(privateFileRelativePath(epub3.cover_uri));
    await checkpoint(session, 'test-017-both-books-library', library);
    result.runtimeAfterEpubImports = await assertNoRuntimeErrors('after-test-017-epub-imports');
    result.tests['TEST-017'] = {
      epub2: { picker: true, readerTitle: importEpub2.readerTitleObserved,
        readerContent: importEpub2.readerContentObserved },
      epub3: { picker: true, readerTitle: importEpub3.readerTitleObserved,
        readerContent: importEpub3.readerContentObserved },
      sqliteIntegrity: imports.sqlite.integrityCheck,
      sqliteRows: importedRows,
      privateEpubFiles: imports.files.books,
      privateCoverFiles: imports.files.covers,
      libraryVisibility: [library.includes(TITLES[0]), library.includes(TITLES[1])],
      runtimeErrors: 'none observed in hierarchy, logcat, or Metro',
      status: importEpub2.readerTitleObserved === true && importEpub2.readerContentObserved === true &&
        importEpub3.readerTitleObserved === true && importEpub3.readerContentObserved === true
        ? 'PASS' : 'PENDING_VISUAL_REVIEW',
    };

    currentTest = 'TEST-011';
    const requestCountBeforeOffline = fake.snapshot().length;
    await fake.close();
    await stopAndResume(session, TITLES[0]);
    library = await waitForLibrary(session, TITLES[0]);
    assert.ok(library.includes(TITLES[1]), 'TEST-011: both books load after force-stop with API down');
    await checkpoint(session, 'test-011-offline-library-reload', library);
    const titleFilter = await searchLibrary(session, TITLES[0], TITLES[0], TITLES[1],
      'test-011-filter-title');
    const authorFilter = await searchLibrary(session, 'Author Three', TITLES[1], TITLES[0],
      'test-011-filter-author');
    const noResult = await searchLibrary(session, 'No Such Wave Five Book',
      'Nenhum livro encontrado', TITLES[0], 'test-011-filter-no-results');
    await clearElement(session, await findElement(session, 'accessibility id', 'Buscar na biblioteca'));
    await pressBack(session);
    library = await waitFor(async () => {
      const source = await getPageSource(session);
      return source.includes(TITLES[0]) && source.includes(TITLES[1]) ? source : false;
    }, { description: 'both books after clearing search', timeoutMs: 15000 });
    const libraryMediaEvidence = await checkpoint(session, 'test-011-cleared-both-books', library);
    result.tests['TEST-011'] = {
      offlineLibraryAfterFakeStoppedAndAppRestarted: true,
      titleFilter: titleFilter.includes(TITLES[0]) && !titleFilter.includes(TITLES[1]),
      authorFilter: authorFilter.includes(TITLES[1]) && !authorFilter.includes(TITLES[0]),
      noResult: noResult.includes('Nenhum livro encontrado'),
      clearRestoredBoth: library.includes(TITLES[0]) && library.includes(TITLES[1]),
      placeholderAndCoverEvidence: {
        hierarchy: 'HIERARCHY_LIMITATION; inspect screenshot with SQLite/filesystem evidence',
        screenshot: libraryMediaEvidence.screenshotPath,
        sqliteRows: imports.sqlite.books,
        privateFiles: imports.files,
      },
      backgroundRequestAttemptsWhileFakeStopped: 'not observable; not an acceptance requirement',
      fakeRequestCountBeforeOffline: requestCountBeforeOffline,
      status: 'PENDING_VISUAL_REVIEW',
    };
    assert.equal(result.tests['TEST-011'].titleFilter, true);
    assert.equal(result.tests['TEST-011'].authorFilter, true);
    assert.equal(result.tests['TEST-011'].noResult, true);
    assert.equal(result.tests['TEST-011'].clearRestoredBoth, true);
    await fake.listen();

    currentTest = 'TEST-019';
    const beforeDuplicate = await captureLocalSnapshot(session,
      'test-019-before-duplicate', 'Leitor EPUB');
    assertSnapshotBooks(beforeDuplicate, 2, 'TEST-019 before duplicate');
    assert.equal(beforeDuplicate.files.covers.length, 1);
    const beforeHashes = beforeDuplicate.sqlite.books.map((row) => row.file_hash).sort();
    assert.equal(new Set(beforeHashes).size, 2, 'TEST-019: existing file hashes are unique');
    const duplicateBaseline = await waitForLibrary(session, TITLES[0]);
    const duplicateUi = await selectFromPicker(session, FIXTURE_NAMES[0], TITLES[0],
      'test-019-duplicate', { allowLibraryResult: true, baselineSource: duplicateBaseline });
    const afterDuplicate = await captureLocalSnapshot(session,
      'test-019-after-duplicate', 'Leitor EPUB');
    assertSnapshotBooks(afterDuplicate, 2, 'TEST-019 after duplicate');
    assert.equal(afterDuplicate.files.covers.length, 1);
    assert.deepEqual(afterDuplicate.files, beforeDuplicate.files,
      'TEST-019 duplicate must not add or replace private EPUB/cover files');
    const duplicateHashes = afterDuplicate.sqlite.books.map((row) => row.file_hash).sort();
    assert.deepEqual(duplicateHashes, beforeHashes,
      'TEST-019 duplicate must preserve the same two SQLite hashes');
    assert.equal(new Set(duplicateHashes).size, 2);
    const failureFixture = result.fixtures.fixtures.find((fixture) =>
      basename(fixture.path) === FIXTURE_NAMES[2]);
    assert.ok(failureFixture, 'TEST-019: insertion-failure fixture metadata exists');
    assert.ok(failureFixture.sha256);
    assert.equal(new Set(result.fixtures.fixtures.map((fixture) => fixture.sha256)).size,
      result.fixtures.fixtures.length, 'TEST-019 fixtures must have distinct hashes');

    const beforeFailureSource = await getPageSource(session);
    await checkpoint(session, 'test-019-before-cover-permission-injection', beforeFailureSource);
    result.permissions = {
      target: 'files/covers',
      before: await directoryPermissionState('files/covers'),
      during: null,
      restorationCommand: null,
      after: null,
    };
    let injection = {
      status: 'BLOCKED_SAFE_INJECTION',
      reason: null,
      importOutcome: null,
      failureUiTextCandidates: [],
      evidence: null,
    };
    const permissionBefore = result.permissions.before;
    if (!permissionBefore.available) {
      injection.reason = 'run-as stat did not report the original directory mode; no permission change or third-fixture import attempted.';
    } else {
      const originalModeNumber = Number.parseInt(permissionBefore.mode, 8);
      const restrictedMode = (originalModeNumber & ~0o222).toString(8);
      let restoreRequired = false;
      try {
        await forceStopPackage();
        restoreRequired = true;
        const chmod = chmodPrivateDirectory('files/covers', restrictedMode);
        result.permissions.restrictionCommand = {
          status: chmod.status,
          stdout: chmod.stdout,
          stderr: chmod.stderr,
          requestedMode: restrictedMode,
        };
        result.permissions.during = await directoryPermissionState('files/covers');
        const duringModeNumber = result.permissions.during.available
          ? Number.parseInt(result.permissions.during.mode, 8)
          : null;
        if (duringModeNumber !== Number.parseInt(restrictedMode, 8) ||
            (duringModeNumber & 0o222) !== 0) {
          injection.reason = 'chmod did not establish a verifiable non-writable covers directory; third fixture was not imported.';
        } else {
          await stopAndResume(session, TITLES[0]);
          injection.importOutcome = await selectFromPicker(session, FIXTURE_NAMES[2],
            FAILURE_TITLE, 'test-019-insert-failure',
            { expectFailure: true, baselineSource: beforeFailureSource });
          injection.evidence = injection.importOutcome.evidence || null;
          injection.failureUiTextCandidates =
            injection.importOutcome.failureUiTextCandidates || [];
          injection.status = injection.importOutcome.route === 'library'
            ? 'FAILURE_UI_CAPTURED'
            : 'PERMISSION_DID_NOT_BLOCK_WRITE';
          if (injection.importOutcome.route === 'reader') {
            injection.reason = 'The restricted covers directory still allowed the cover write.';
          }
        }
      } finally {
        if (restoreRequired) {
          await forceStopPackage();
          const restore = chmodPrivateDirectory('files/covers', permissionBefore.mode);
          result.permissions.restorationCommand = {
            status: restore.status,
            stdout: restore.stdout,
            stderr: restore.stderr,
            requestedMode: permissionBefore.mode,
          };
          result.permissions.after = await directoryPermissionState('files/covers');
          result.permissions.restored = permissionBefore.available ? result.permissions.after.mode === permissionBefore.mode : null;
          await saveJson(join(ARTIFACT_DIR, 'permissions', 'test-019-covers.json'),
            result.permissions);
          if (!result.permissions.restored) {
            throw new Error('TEST-019: failed to restore files/covers mode to ' +
              permissionBefore.mode + '; actual mode=' + result.permissions.after.mode);
          }
        }
      }
    }
    if (!result.permissions.after) {
      result.permissions.after = await directoryPermissionState('files/covers');
      result.permissions.restored = permissionBefore.available ? result.permissions.after.mode === permissionBefore.mode : null;
      await saveJson(join(ARTIFACT_DIR, 'permissions', 'test-019-covers.json'),
        result.permissions);
    }

    let afterFailure = await captureLocalSnapshot(session,
      'test-019-after-failure-injection', 'Leitor EPUB');
    const failureRow = afterFailure.sqlite?.books?.find((row) => row.title === FAILURE_TITLE);
    if (injection.status === 'PERMISSION_DID_NOT_BLOCK_WRITE' && failureRow) {
      assert.notEqual(failureRow.file_hash, null);
      assert.ok(failureRow.cover_uri, 'TEST-019: successful third import has a correlated cover');
      assert.ok(afterFailure.files.books.length > 2);
      await deleteBook(session, FAILURE_TITLE, 'Remover', afterFailure);
      await waitForLibrary(session, TITLES[0]);
      afterFailure = await captureLocalSnapshot(session,
        'test-019-reset-after-blocked-injection', 'Leitor EPUB');
      injection.cleanupAfterBlockedInjection = 'third synthetic import removed through product UI to restore the two-book precondition';
    }
    assertSnapshotBooks(afterFailure, 2, 'TEST-019 after failure injection');
    assert.equal(afterFailure.files.covers.length, 1, 'TEST-019: original EPUB3 cover remains');
    assert.deepEqual(afterFailure.files, beforeDuplicate.files,
      'TEST-019 failure cleanup must leave no orphan EPUB or cover');
    assert.deepEqual(afterFailure.sqlite.books.map((row) => row.file_hash).sort(), beforeHashes,
      'TEST-019 failure cleanup must preserve the two original hashes');
    assert.equal(afterFailure.sqlite.books.some((row) => row.title === FAILURE_TITLE), false,
      'TEST-019 failure cleanup must not insert the synthetic failure fixture');
    const injectionPassed = injection.status === 'FAILURE_UI_CAPTURED' &&
      injection.failureUiTextCandidates.length > 0 && result.permissions.restored;
    result.tests['TEST-019'] = {
      duplicatePath: 'PASS',
      rowsBefore: beforeDuplicate.sqlite.books.length,
      rowsAfterDuplicate: afterDuplicate.sqlite.books.length,
      filesBefore: beforeDuplicate.files,
      filesAfterDuplicate: afterDuplicate.files,
      hashesBefore: beforeHashes,
      hashesAfterDuplicate: duplicateHashes,
      duplicateUi: duplicateUi,
      failureInjection: injection.status,
      failureUiTextCandidates: injection.failureUiTextCandidates,
      permissionBefore: result.permissions.before,
      permissionDuring: result.permissions.during,
      permissionRestored: result.permissions.restored,
      cleanup: 'PASS',
      rowsAfterFailure: afterFailure.sqlite.books.length,
      filesAfterFailure: afterFailure.files,
      databaseIntegrity: afterFailure.sqlite.integrityCheck,
      orphanEpub: false,
      orphanCover: false,
      limitation: injection.reason,
      status: injectionPassed ? 'PASS' : 'PARTIAL',
    };

    currentTest = 'TEST-022';
    const httpRequestsForDelete = [];
    const cancelStart = fake.snapshot().length;
    await deleteBook(session, TITLES[0], 'Cancelar', afterFailure);
    library = await waitForLibrary(session, TITLES[0]);
    assert.ok(library.includes(TITLES[1]), 'TEST-022 cancel leaves both books visible');
    httpRequestsForDelete.push(...fake.snapshot().slice(cancelStart));
    const afterCancel = await captureLocalSnapshot(session, 'test-022-after-cancel', 'Leitor EPUB');
    assert.deepEqual(afterCancel.files, afterFailure.files);
    assert.deepEqual(afterCancel.sqlite.books, afterFailure.sqlite.books);
    await checkpoint(session, 'test-022-after-cancel', await waitForLibrary(session, TITLES[0]));

    const noCoverDeleteStart = fake.snapshot().length;
    await deleteBook(session, TITLES[0], 'Remover', afterCancel);
    library = await waitForLibrary(session, TITLES[1]);
    assert.equal(library.includes(TITLES[0]), false);
    httpRequestsForDelete.push(...fake.snapshot().slice(noCoverDeleteStart));
    const afterNoCoverDelete = await captureLocalSnapshot(session,
      'test-022-delete-no-cover', 'Leitor EPUB');
    assertSnapshotBooks(afterNoCoverDelete, 1, 'TEST-022 delete without cover');
    assert.equal(afterNoCoverDelete.files.covers.length, 1,
      'TEST-022 EPUB2 delete preserves the EPUB3 cover');
    assert.equal(afterNoCoverDelete.sqlite.books[0].title, TITLES[1]);
    assert.ok(afterNoCoverDelete.sqlite.books[0].cover_uri);

    const withCoverDeleteStart = fake.snapshot().length;
    await deleteBook(session, TITLES[1], 'Remover', afterNoCoverDelete);
    library = await waitForLibrary(session);
    assertHealthy(library, 'empty library after delete with cover');
    assert.ok(library.includes('Sua biblioteca está vazia'));
    httpRequestsForDelete.push(...fake.snapshot().slice(withCoverDeleteStart));
    const afterWithCoverDelete = await captureLocalSnapshot(session,
      'test-022-delete-with-cover', 'Sua biblioteca está vazia');
    assertSnapshotBooks(afterWithCoverDelete, 0, 'TEST-022 delete with cover');
    assert.equal(afterWithCoverDelete.files.covers.length, 0);
    const httpDeleteCalls = httpRequestsForDelete.filter((entry) => {
      const urlPath = String(entry.url || '').split('?')[0].toLowerCase();
      return entry.method === 'DELETE' ||
        (entry.method === 'POST' && /\/(?:delete|sync)(?:\/|$)/.test(urlPath));
    });
    assert.deepEqual(httpDeleteCalls, [], 'TEST-022 local deletes must not issue HTTP delete/sync calls');
    assert.deepEqual(fake.unexpected, [], 'fake API contract received no unexpected endpoint');
    result.tests['TEST-022'] = {
      cancel: true,
      deleteNoCover: true,
      deleteWithCover: true,
      sqliteAfterNoCoverDelete: afterNoCoverDelete.sqlite.books,
      sqliteAfterAllDeletes: afterWithCoverDelete.sqlite.books,
      privateFilesAfterNoCoverDelete: afterNoCoverDelete.files,
      privateFilesAfterAllDeletes: afterWithCoverDelete.files,
      databaseIntegrity: [afterCancel.sqlite.integrityCheck,
        afterNoCoverDelete.sqlite.integrityCheck, afterWithCoverDelete.sqlite.integrityCheck],
      requestsObservedDuringDelete: httpRequestsForDelete,
      httpDeleteCalls,
      status: 'PASS',
    };

    result.tests['TEST-011'].visualStatus = 'PENDING_VISUAL_REVIEW';
    result.finalFakeRequests = fake.snapshot();
    result.unexpectedFakeRequests = fake.unexpected;
    result.finalAppProcessAlive = await appAlive();
    assert.equal(result.finalAppProcessAlive, true);
    await checkpoint(session, 'final-empty-library', library);
    result.runtimeAfterGroupA = await assertNoRuntimeErrors('after-group-a');
    result.logcat = {
      final: await saveLogcat('final'),
      readerRoute: await saveLogcat('reader-route'),
    };
    result.groupAStatus = Object.values(result.tests).every((test) => test.status === 'PASS')
      ? 'COMPLETE'
      : 'INCOMPLETE';
    currentTest = 'complete';
    return result;
  } catch (error) {
    result.interruptedAt = currentTest;
    result.error = error instanceof Error ? error.message : String(error);
    error.wave5Result = result;
    throw error;
  } finally {
    try {
      await saveJson(join(ARTIFACT_DIR, 'fake-api-requests.json'), {
        requests: fake.snapshot(),
        unexpected: fake.unexpected,
      });
      await saveJson(join(ARTIFACT_DIR, 'partial-observations.json'), result);
      await saveLogcat('last-observed');
    } catch (error) {
      console.error('Could not save final evidence:', error.message);
    }
    if (session?.id) {
      try { await deleteSession(session); } catch (error) {
        console.error('Appium session cleanup failed:', error.message);
      }
    }
    await fake.close().catch((error) => console.error('Fake API cleanup failed:', error.message));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runGroupA();
    await saveJson(join(ARTIFACT_DIR, 'group-a-observations.json'), result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const failure = {
      ...(error.wave5Result || {}),
      status: 'interrupted',
      error: error instanceof Error ? error.message : String(error),
      artifacts: ARTIFACT_DIR,
    };
    try { await saveJson(join(ARTIFACT_DIR, 'group-a-failure.json'), failure); } catch {}
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  }
}
