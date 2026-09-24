import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as helpers from './helpers.mjs';

const expoFirstRunScreen =
  '<node text="This is the developer menu. It gives you access to useful tools in your development builds." />' +
  '<node text="Continue" />';
const dismissedDevClientScreen = '<node text="Leitor EPUB" /><node text="Runtime version: exposdk:57.0.0" />';
const loginScreen = '<node text="Entrar no Leitor" /><node text="E-mail" />';

test('recognizes only the first-run Expo developer-menu screen before product login', () => {
  assert.equal(typeof helpers.isFirstRunDevClientMenu, 'function');
  assert.equal(helpers.isFirstRunDevClientMenu(expoFirstRunScreen), true);
  assert.equal(helpers.isFirstRunDevClientMenu(dismissedDevClientScreen), false);
  assert.equal(helpers.isFirstRunDevClientMenu(loginScreen), false);
});

const devLauncherHome = '<node text="Development Build" /><node text="DEVELOPMENT SERVERS" /><node text="Connect" />';

test('recognizes the Dev Client server connection screen, not product or Dev Menu screens', () => {
  assert.equal(typeof helpers.isDevLauncherHome, 'function');
  assert.equal(helpers.isDevLauncherHome(devLauncherHome), true);
  assert.equal(helpers.isDevLauncherHome(expoFirstRunScreen), false);
  assert.equal(helpers.isDevLauncherHome(loginScreen), false);
});


test('clears an Appium element through the W3C WebDriver endpoint', async () => {
  assert.equal(typeof helpers.clearElement, 'function');
  let observed;
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    observed = { method: request.method, url: request.url, body };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ value: null }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const previousUrl = process.env.APPIUM_URL;
  process.env.APPIUM_URL = 'http://127.0.0.1:' + server.address().port;
  try {
    await helpers.clearElement({ id: 'session-1' }, 'element-1');
    assert.deepEqual(observed, {
      method: 'POST',
      url: '/session/session-1/element/element-1/clear',
      body: '{}',
    });
  } finally {
    if (previousUrl === undefined) delete process.env.APPIUM_URL;
    else process.env.APPIUM_URL = previousUrl;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
