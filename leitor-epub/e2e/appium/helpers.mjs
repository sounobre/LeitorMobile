import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';

const DEFAULT_APPIUM_URL = 'http://127.0.0.1:4723';

function appiumBaseUrl() {
  return (process.env.APPIUM_URL || DEFAULT_APPIUM_URL).replace(/\/+$/, '');
}

function sessionPath(session, suffix = '') {
  if (!session?.id) throw new Error('Appium session is not active.');
  return '/session/' + encodeURIComponent(session.id) + suffix;
}

async function request(path, options = {}) {
  const response = await fetch(appiumBaseUrl() + path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { raw };
    }
  }
  const value = payload?.value;
  if (!response.ok || value?.error) {
    const message = value?.message || payload?.message || raw || response.statusText;
    throw new Error('Appium ' + response.status + ' ' + path + ': ' + message);
  }
  return payload;
}

function unwrap(payload) {
  return payload && Object.prototype.hasOwnProperty.call(payload, 'value')
    ? payload.value
    : payload;
}

function elementId(element) {
  if (typeof element === 'string') return element;
  const id = element?.['element-6066-11e4-a52e-4f735466cecf'] || element?.ELEMENT;
  if (!id) throw new Error('Appium response did not contain a W3C element id.');
  return id;
}

export function isFirstRunDevClientMenu(source) {
  const hierarchy = String(source || '');
  return !hierarchy.includes('Entrar no Leitor') &&
    hierarchy.includes('developer menu') &&
    hierarchy.includes('Continue');
}

export function isDevLauncherHome(source) {
  const hierarchy = String(source || '');
  return !hierarchy.includes('Entrar no Leitor') &&
    !hierarchy.includes('This is the developer menu') &&
    hierarchy.includes('Development Build') &&
    hierarchy.includes('DEVELOPMENT SERVERS') &&
    hierarchy.includes('Connect');
}
export async function createSession() {
  const capabilities = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.APPIUM_DEVICE_NAME || 'Pixel_8',
    'appium:udid': process.env.APPIUM_UDID || 'emulator-5554',
    'appium:appPackage': process.env.APP_PACKAGE || 'com.example.leitorepub',
    'appium:appActivity': process.env.APP_ACTIVITY || 'com.example.leitorepub.MainActivity',
    'appium:noReset': true,
    'appium:newCommandTimeout': 300,
  };
  const payload = await request('/session', {
    method: 'POST',
    body: { capabilities: { alwaysMatch: capabilities } },
  });
  const value = payload?.value || {};
  const id = value.sessionId || payload?.sessionId;
  if (!id) throw new Error('Appium created no session id: ' + JSON.stringify(payload));
  return { id, capabilities: value.capabilities || capabilities };
}

export async function deleteSession(session) {
  if (!session?.id) return;
  await request(sessionPath(session), { method: 'DELETE' });
  session.id = null;
}

export async function findElement(session, using, value) {
  const payload = await request(sessionPath(session, '/element'), {
    method: 'POST',
    body: { using, value },
  });
  return elementId(unwrap(payload));
}

export async function findElements(session, using, value) {
  const payload = await request(sessionPath(session, '/elements'), {
    method: 'POST',
    body: { using, value },
  });
  const elements = unwrap(payload);
  return Array.isArray(elements) ? elements.map(elementId) : [];
}

export async function click(session, element) {
  await request(sessionPath(session, '/element/' + encodeURIComponent(elementId(element)) + '/click'), {
    method: 'POST',
    body: {},
  });
}

export async function clearElement(session, element) {
  await request(sessionPath(session, '/element/' + encodeURIComponent(elementId(element)) + '/clear'), {
    method: 'POST',
    body: {},
  });
}

export async function setValue(session, element, value) {
  const text = String(value);
  await request(sessionPath(session, '/element/' + encodeURIComponent(elementId(element)) + '/value'), {
    method: 'POST',
    body: { text, value: Array.from(text) },
  });
}

export async function getText(session, element) {
  return String(unwrap(await request(
    sessionPath(session, '/element/' + encodeURIComponent(elementId(element)) + '/text'),
  )) ?? '');
}

export async function getAttribute(session, element, name) {
  const suffix = '/element/' + encodeURIComponent(elementId(element)) + '/attribute/' + encodeURIComponent(name);
  return unwrap(await request(sessionPath(session, suffix)));
}

export async function getPageSource(session) {
  return String(unwrap(await request(sessionPath(session, '/source'))) ?? '');
}

export async function takeScreenshot(session, outputPath) {
  const base64 = String(unwrap(await request(sessionPath(session, '/screenshot'))) ?? '');
  if (!base64) throw new Error('Appium returned an empty screenshot.');
  await writeFile(outputPath, Buffer.from(base64, 'base64'));
  return outputPath;
}

export async function executeMobileCommand(session, script, args = []) {
  const normalizedArgs = Array.isArray(args) ? args : [args];
  const payload = await request(sessionPath(session, '/execute/sync'), {
    method: 'POST',
    body: { script, args: normalizedArgs },
  });
  return unwrap(payload);
}

export async function pressBack(session) {
  return executeMobileCommand(session, 'mobile: pressKey', { keycode: 4 });
}

export async function waitFor(condition, options = {}) {
  const timeoutMs = options.timeoutMs ?? 20000;
  const intervalMs = options.intervalMs ?? 250;
  const description = options.description || 'condition';
  const endAt = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() <= endAt) {
    try {
      const result = await condition();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  const suffix = lastError instanceof Error ? ': ' + lastError.message : '';
  throw new Error('Timed out after ' + timeoutMs + 'ms waiting for ' + description + suffix);
}
