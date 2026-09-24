import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { waitFor } from './helpers.mjs';

const EXPECTED_EMAIL = 'wave5@example.invalid';
const EXPECTED_PASSWORD = 'wave5-password';
const SYNTHETIC_TOKEN = 'wave5-group-a-token';

function writeJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

export function createFakeApi(options = {}) {
  const host = options.host || process.env.FAKE_API_HOST || '127.0.0.1';
  const port = Number(options.port || process.env.FAKE_API_PORT || 18080);
  const requests = [];
  const unexpected = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://' + host + ':' + port);
    const entry = {
      at: new Date().toISOString(),
      method: request.method || 'GET',
      url: url.pathname + url.search,
    };
    requests.push(entry);
    let body = {};
    if (entry.method === 'POST' && url.pathname === '/api/auth/login') {
      try {
        body = await readJson(request);
      } catch {
        entry.status = 400;
        console.log('[fake-api] POST /api/auth/login -> 400 invalid JSON');
        writeJson(response, 400, { message: 'Invalid JSON.' });
        return;
      }
      entry.email = typeof body.email === 'string' ? body.email : '';
      entry.credentialsMatched = body.email === EXPECTED_EMAIL && body.password === EXPECTED_PASSWORD;
      entry.status = entry.credentialsMatched ? 200 : 401;
      console.log('[fake-api] POST /api/auth/login -> ' + entry.status + ' email=' + entry.email);
      if (!entry.credentialsMatched) {
        writeJson(response, 401, { message: 'Synthetic credentials do not match.' });
        return;
      }
      writeJson(response, 200, {
        token: SYNTHETIC_TOKEN,
        user: { email: EXPECTED_EMAIL },
      });
      return;
    }
    if (entry.method === 'GET' && url.pathname === '/api/books' && !url.search) {
      entry.status = 200;
      console.log('[fake-api] GET /api/books -> 200 []');
      writeJson(response, 200, []);
      return;
    }
    if (
      entry.method === 'GET' &&
      url.pathname === '/api/cards' &&
      url.searchParams.get('includeArchived') === 'true' &&
      [...url.searchParams.keys()].length === 1
    ) {
      entry.status = 200;
      console.log('[fake-api] GET /api/cards?includeArchived=true -> 200 []');
      writeJson(response, 200, []);
      return;
    }
    entry.status = 501;
    unexpected.push(entry);
    console.error('[fake-api] UNEXPECTED ' + entry.method + ' ' + entry.url + ' -> 501');
    writeJson(response, 501, { message: 'Unexpected endpoint in Wave 5E fake API.' });
  });

  return {
    host,
    port,
    requests,
    unexpected,
    async listen() {
      if (server.listening) return;
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
      console.log('[fake-api] listening at http://' + host + ':' + port);
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      console.log('[fake-api] stopped');
    },
    async waitForRequest(predicate, description, timeoutMs = 15000) {
      return waitFor(
        () => requests.find(predicate),
        { description: description || 'fake API request', timeoutMs, intervalMs: 150 },
      );
    },
    snapshot() {
      return requests.map((entry) => ({ ...entry }));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fake = createFakeApi();
  await fake.listen();
  const close = async () => {
    await fake.close();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
