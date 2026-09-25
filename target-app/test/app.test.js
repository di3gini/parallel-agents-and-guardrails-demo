const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const app = require('../server');

let server;
let baseUrl;

test.before(async () => {
  execFileSync(process.execPath, ['scripts/seed.js'], { cwd: path.join(__dirname, '..') });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

test.after(() => {
  server.close();
});

test('GET /api/users returns the seeded users', async () => {
  const res = await fetch(`${baseUrl}/api/users`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.length, 3);
  assert.equal(body[0].name, 'Ada Lovelace');
});

test('GET /api/posts attaches the author name to each post', async () => {
  const res = await fetch(`${baseUrl}/api/posts`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.length, 5);
  assert.ok(body.every((post) => typeof post.author === 'string'));
});
