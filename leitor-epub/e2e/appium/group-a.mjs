import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
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
  join(process.env.TEMP || tmpdir(), 'wave-5e-group-a'));
const FIXTURE_DIR = resolve(process.env.WAVE5_FIXTURE_DIR ||
  join(process.env.TEMP || tmpdir(), 'wave-5e-group-a', 'fixtures'));
const API_BASE_URL = 'http://127.0.0.1:18080/api';
const LOGIN_EMAIL = 'wave5@example.invalid';
const LOGIN_PASSWORD = 'wave5-password';
const FIXTURE_NAMES = ['wave5-epub2.epub', 'wave5-epub3.epub'];
const TITLES = ['Wave Five EPUB Two', 'Wave Five EPUB Three'];
const API_SEQUENCE = [
  'POST /api/auth/login',
  'GET /api/books',
  'GET /api/cards?includeArchived=true',
];

function run(command, args, options = {}) {
  const output = spawnSync(command, args, {
    encoding: options.encoding === null ? null : 'utf8',
    maxBuffer: options.maxBuffer || 16 * 1024 * 1024,
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
  const all = text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
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
  'session = []',
  'books = []',
  'if "sync_session" in tables:',
  ' session = [dict(row) for row in db.execute("SELECT email, api_base_url FROM sync_session ORDER BY id")]',
  'if "books" in tables:',
  ' books = [dict(row) for row in db.execute("SELECT id, title, author, file_hash, file_uri, cover_uri, imported_at, last_opened_at FROM books ORDER BY COALESCE(last_opened_at, imported_at) DESC")]',
  'print(json.dumps({"session": session, "books": books, "bookCount": len(books)}, ensure_ascii=False))',
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

async function selectFromPicker(session, filename, title, checkpointPrefix) {
  const importControl = await findElement(session, 'accessibility id', 'Importar livro EPUB');
  await click(session, importControl);
  await waitFor(async () => {
    const foreground = await currentPackage(session);
    return foreground.includes('documentsui') || foreground.includes('DocumentsUI') ? foreground : false;
  }, { description: 'DocumentsUI launched by product import control', timeoutMs: 30000 });
  let source = await getPageSource(session);
  assertHealthy(source, checkpointPrefix + ' picker');
  await checkpoint(session, checkpointPrefix + '-picker-open', source);
  if (!source.includes(filename)) {
    const roots = await waitFor(() => findVisibleText(session, 'Show roots'), {
      description: 'DocumentsUI Show roots control', timeoutMs: 15000,
    });
    await click(session, roots);
    source = await waitForSource(session, 'Downloads', 'DocumentsUI Downloads root');
    await saveSource(checkpointPrefix + '-picker-roots', source);
    await clickText(session, 'Downloads');
    source = await waitForSource(session, filename, 'Downloads fixture ' + filename);
  } else {
    source = await waitForSource(session, filename, 'picker fixture ' + filename);
  }
  await checkpoint(session, checkpointPrefix + '-picker-file', source);
  await clickText(session, filename);
  const foreground = await waitForPackage(session, PACKAGE,
    'return from picker to product after selecting ' + filename, 60000);
  source = await waitForSource(session, title, 'reader route title ' + title, 60000);
  assertHealthy(source, checkpointPrefix + ' reader route');
  await checkpoint(session, checkpointPrefix + '-reader-route', source);
  await pressBack(session);
  source = await waitFor(async () => {
    const current = await getPageSource(session);
    return current.includes('Buscar na biblioteca') && current.includes(title) ? current : false;
  }, { description: 'library restored after reader route', timeoutMs: 30000 });
  assertHealthy(source, checkpointPrefix + ' library return');
  await checkpoint(session, checkpointPrefix + '-library-return', source);
  return { foreground, readerTitleObserved: true, returnedToLibrary: true };
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
    wave: '5E',
    group: 'A',
    environment: { udid: UDID, api: API_LEVEL, appPackage: PACKAGE },
    artifacts: ARTIFACT_DIR,
    fixtures: null,
    tests: {},
  };
  let session;
  let currentTest = 'setup';
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
    const deepLink = 'exp+leitor-epub://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081';
    currentTest = 'TEST-004';
    const loginSource = await loadProductLogin(session, deepLink);
    let library = await enterLogin(session, loginSource);
    assertHealthy(library, 'library after login');
    const apiSequence = await observedLoginSync(fake);
    await checkpoint(session, 'test-004-library-before-restart', library);
    const requestCountAtStop = fake.snapshot().length;
    await fake.close();
    const sessionSnapshot = await captureLocalSnapshot(session, 'test-004-session', 'Leitor EPUB');
    library = await waitForLibrary(session);
    assert.equal(library.includes('Entrar no Leitor'), false);
    await checkpoint(session, 'test-004-library-after-restart', library);
    assert.equal(fake.snapshot().length, requestCountAtStop);
    const sessionRows = sessionSnapshot.sqlite?.session;
    result.tests['TEST-004'] = {
      uiLogin: true,
      libraryReached: true,
      restartStayedOnLibrary: true,
      localSessionRows: sessionRows || null,
      sessionSqliteReadOnlyAvailable: Array.isArray(sessionRows),
      initialSyncObservedSeparately: apiSequence,
      runtimeErrors: 'none observed in hierarchy',
      status: 'observed',
    };
    if (Array.isArray(sessionRows)) {
      assert.equal(sessionRows.length, 1);
      assert.equal(sessionRows[0].email, LOGIN_EMAIL);
      assert.equal(sessionRows[0].api_base_url, API_BASE_URL);
    }

    currentTest = 'TEST-017';
    const importEpub2 = await selectFromPicker(session, FIXTURE_NAMES[0], TITLES[0], 'test-017-epub2');
    const importEpub3 = await selectFromPicker(session, FIXTURE_NAMES[1], TITLES[1], 'test-017-epub3');
    const imports = await captureLocalSnapshot(session, 'test-017-imported-books', 'Leitor EPUB');
    library = await waitForLibrary(session, TITLES[0]);
    assert.ok(library.includes(TITLES[1]));
    assert.equal(imports.files.books.length, 2);
    assert.equal(imports.files.covers.length, 1);
    const importedRows = imports.sqlite?.books;
    if (Array.isArray(importedRows)) {
      assert.equal(importedRows.length, 2);
      const epub2 = importedRows.find((row) => row.title === TITLES[0]);
      const epub3 = importedRows.find((row) => row.title === TITLES[1]);
      assert.ok(epub2 && epub3);
      assert.ok(epub2.file_hash && epub3.file_hash);
      assert.ok(epub2.file_uri.startsWith('file:') && epub3.file_uri.startsWith('file:'));
      assert.equal(epub2.cover_uri, null);
      assert.ok(epub3.cover_uri);
    }
    await checkpoint(session, 'test-017-both-books-library', library);
    result.tests['TEST-017'] = {
      epub2: importEpub2,
      epub3: importEpub3,
      readerRouteReachedForBoth: true,
      sqliteRows: importedRows || null,
      privateEpubFiles: imports.files.books,
      privateCoverFiles: imports.files.covers,
      status: 'observed',
    };

    currentTest = 'TEST-011';
    const requestCountOffline = fake.snapshot().length;
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
    }, { description: 'both books after search clear', timeoutMs: 15000 });
    await checkpoint(session, 'test-011-cleared-both-books', library);
    result.tests['TEST-011'] = {
      offlineWithFakeStopped: true,
      titleFilter: titleFilter.includes(TITLES[0]) && !titleFilter.includes(TITLES[1]),
      authorFilter: authorFilter.includes(TITLES[1]) && !authorFilter.includes(TITLES[0]),
      noResults: noResult.includes('Nenhum livro encontrado'),
      clearRestoredBoth: library.includes(TITLES[0]) && library.includes(TITLES[1]),
      placeholderAndCoverHierarchy: 'NOT_OBSERVABLE_BY_HIERARCHY; screenshot retained for visual inspection',
      fakeRequestsDuringOffline: fake.snapshot().length - requestCountOffline,
      status: 'observed',
    };
    assert.equal(result.tests['TEST-011'].fakeRequestsDuringOffline, 0);
    assert.equal(fake.snapshot().length, requestCountOffline);

    currentTest = 'TEST-019';
    await fake.listen();
    const beforeDuplicate = await captureLocalSnapshot(session, 'test-019-before-duplicate', 'Leitor EPUB');
    assert.equal(beforeDuplicate.files.books.length, 2);
    const duplicateUi = await selectFromPicker(session, FIXTURE_NAMES[0], TITLES[0], 'test-019-duplicate');
    const afterDuplicate = await captureLocalSnapshot(session, 'test-019-after-duplicate', 'Leitor EPUB');
    const duplicateRows = afterDuplicate.sqlite?.books;
    assert.equal(afterDuplicate.files.books.length, 2);
    if (Array.isArray(duplicateRows)) {
      assert.equal(duplicateRows.length, 2);
      assert.equal(new Set(duplicateRows.map((row) => row.file_hash)).size, 2);
    }
    const requestsBeforeDelete = fake.snapshot().length;
    result.tests['TEST-019'] = {
      duplicatePath: 'observed',
      rowsBefore: beforeDuplicate.sqlite?.books?.length ?? null,
      rowsAfter: duplicateRows?.length ?? null,
      privateEpubFilesBefore: beforeDuplicate.files.books.length,
      privateEpubFilesAfter: afterDuplicate.files.books.length,
      duplicateUiReturnedToLibrary: duplicateUi.returnedToLibrary,
      duplicateMessageObserved: false,
      partialFailureCleanup: 'BLOCKED_SAFE_INJECTION',
      partialFailureReason: 'adb shell which sqlite3 returned no path; no DB mutation, production hook, migration change, or third-EPUB import was attempted.',
      status: 'partial',
    };

    currentTest = 'TEST-022';
    await deleteBook(session, TITLES[0], 'Cancelar', afterDuplicate);
    library = await waitForLibrary(session, TITLES[0]);
    assert.ok(library.includes(TITLES[1]));
    const afterCancel = await captureLocalSnapshot(session, 'test-022-after-cancel', 'Leitor EPUB');
    assert.deepEqual(afterCancel.files, afterDuplicate.files);
    if (Array.isArray(afterCancel.sqlite?.books) && Array.isArray(afterDuplicate.sqlite?.books)) {
      assert.deepEqual(afterCancel.sqlite.books, afterDuplicate.sqlite.books);
    }
    await checkpoint(session, 'test-022-after-cancel',
      await waitForLibrary(session, TITLES[0]));

    await deleteBook(session, TITLES[0], 'Remover', afterCancel);
    library = await waitForLibrary(session, TITLES[1]);
    assert.equal(library.includes(TITLES[0]), false);
    const afterNoCoverDelete = await captureLocalSnapshot(session, 'test-022-delete-no-cover', 'Leitor EPUB');
    assert.equal(afterNoCoverDelete.files.books.length, 1);
    assert.equal(afterNoCoverDelete.files.covers.length, 1);
    assert.equal(afterNoCoverDelete.sqlite?.books?.length, 1);
    assert.equal(afterNoCoverDelete.sqlite.books.some((row) => row.title === TITLES[0]), false);

    await deleteBook(session, TITLES[1], 'Remover', afterNoCoverDelete);
    library = await waitForLibrary(session);
    assertHealthy(library, 'empty library after delete with cover');
    const afterWithCoverDelete = await captureLocalSnapshot(session, 'test-022-delete-with-cover',
      'Sua biblioteca está vazia');
    assert.equal(afterWithCoverDelete.files.books.length, 0);
    assert.equal(afterWithCoverDelete.files.covers.length, 0);
    assert.equal(afterWithCoverDelete.sqlite?.books?.length, 0);
    assert.ok(library.includes('Sua biblioteca está vazia'));
    assert.equal(fake.snapshot().length, requestsBeforeDelete);
    assert.deepEqual(fake.unexpected, []);
    result.tests['TEST-022'] = {
      cancel: true,
      deleteNoCover: true,
      deleteWithCover: true,
      sqliteAfterNoCoverDelete: afterNoCoverDelete.sqlite?.books || null,
      sqliteAfterAllDeletes: afterWithCoverDelete.sqlite?.books || null,
      privateFilesAfterNoCoverDelete: afterNoCoverDelete.files,
      privateFilesAfterAllDeletes: afterWithCoverDelete.files,
      fakeRequestsDuringDelete: fake.snapshot().length - requestsBeforeDelete,
      status: 'observed',
    };

    result.finalFakeRequests = fake.snapshot();
    result.unexpectedFakeRequests = fake.unexpected;
    result.finalAppProcessAlive = await appAlive();
    assert.equal(result.finalAppProcessAlive, true);
    await checkpoint(session, 'final-empty-library', library);
    result.logcat = {
      final: await saveLogcat('final'),
      readerRoute: await saveLogcat('reader-route'),
    };
    await saveJson(join(ARTIFACT_DIR, 'selectors.json'), {
      loginFields: 'android.widget.EditText indices 0=email, 1=password, 2=API',
      loginButton: 'accessibility id: Entrar e sincronizar',
      importAction: 'accessibility id: Importar livro EPUB',
      librarySearch: 'accessibility id: Buscar na biblioteca',
      bookMenu: 'accessibility id: Opcoes do livro; element order mapped to SQLite list order',
      deleteMenuItem: 'visible-text selector: Excluir livro',
      pickerFile: 'visible-text selector: filename shown in DocumentsUI',
      alertButtons: ['Cancelar', 'Remover'],
    });
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
