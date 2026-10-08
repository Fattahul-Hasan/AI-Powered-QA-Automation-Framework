// PHASE 2 — Generic Framework Completion & End-to-End Validation.
//
// A minimal, entirely generic, local-only HTTP server used ONLY to prove the authentication
// and API-testing foundations (utils/auth.js, utils/auth-api-adapter.js, utils/api-client.js)
// work end-to-end, without ever touching a real application. It models no real business, no
// real product, and no real customer -- it is disposable test infrastructure, started on an
// ephemeral local port and torn down at the end of each test. This file is new/additive; it
// does not modify any Phase 1 baseline file.
//
// The credentials below are synthetic fixture data for this throwaway local server only (the
// server exists solely for this test run and is never exposed beyond localhost) -- not a real
// secret, consistent with how existing framework tests already use literal test credentials
// (see tests/framework/authentication-utilities.spec.js).

const http = require('http');

const MOCK_USERNAME = 'demo-agent';
const MOCK_PASSWORD = 'demo-pass-123';
const SESSION_COOKIE = 'session=valid';

function loginPageHtml() {
  return `<!doctype html>
<html><body>
  <form method="POST" action="/login">
    <input id="username" name="username" type="text" />
    <input id="password" name="password" type="password" />
    <button id="submit" type="submit">Log in</button>
  </form>
</body></html>`;
}

function dashboardHtml() {
  return `<!doctype html><html><body><h1 id="welcome">Welcome</h1></body></html>`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function hasValidSession(req) {
  const cookie = req.headers.cookie || '';
  return cookie.includes(SESSION_COOKIE);
}

async function requestHandler(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/login') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(loginPageHtml());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/login') {
    const body = await readBody(req);
    const params = new URLSearchParams(body);
    if (params.get('username') === MOCK_USERNAME && params.get('password') === MOCK_PASSWORD) {
      res.writeHead(302, { Location: '/dashboard', 'Set-Cookie': SESSION_COOKIE });
      res.end();
    } else {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Invalid credentials');
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/dashboard') {
    if (hasValidSession(req)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(dashboardHtml());
    } else {
      res.writeHead(302, { Location: '/login' });
      res.end();
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/token') {
    const body = await readBody(req);
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid JSON body' }));
      return;
    }
    if (parsed.username === MOCK_USERNAME && parsed.password === MOCK_PASSWORD) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ access_token: `mock-token-${Date.now()}` }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid credentials' }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

function startMockServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      requestHandler(req, res).catch((err) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(String(err));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        port,
        url: `http://127.0.0.1:${port}`,
        stop: () => new Promise((res) => server.close(res)),
      });
    });
  });
}

module.exports = { startMockServer, MOCK_USERNAME, MOCK_PASSWORD };
