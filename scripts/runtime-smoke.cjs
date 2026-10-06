const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');

// Child fixtures use the real built Express application with an in-process SQL
// substitute. They never inherit production credentials or access a real database.
if (process.argv[2] === '--fixture-child') {
  const mode = process.argv[4];
  const state = new Map([['settings', { schoolName: 'Fixture School' }]]);
  class FixturePool {
    on() { return this; }
    async query(statement, params) {
      if (mode !== 'online-ready') throw new Error('FIXTURE_POSTGRES_UNAVAILABLE');
      const sql = statement.trim();
      if (sql === 'SELECT key, value FROM app_store') {
        return { rows: [...state].map(([key, value]) => ({ key, value })) };
      }
      if (sql.startsWith('SELECT value FROM app_store')) {
        return { rows: state.has(params[0]) ? [{ value: state.get(params[0]) }] : [] };
      }
      if (sql.startsWith('INSERT INTO app_store')) state.set(params[0], JSON.parse(params[1]));
      return { rows: [] };
    }
    async connect() { return { query: this.query.bind(this), release() {} }; }
    async end() {}
  }
  require('pg').Pool = FixturePool;
  os.networkInterfaces = () => { const error = new Error('Fixture interface restriction'); error.code = 'FIXTURE'; throw error; };
  const listen = http.Server.prototype.listen;
  http.Server.prototype.listen = function (...args) {
    this.once('listening', () => process.send({ port: this.address().port }));
    return listen.apply(this, args);
  };
  require(process.argv[3]);
} else {
  function request(port, url, method = 'GET') {
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port, path: url, method }, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.setTimeout(3000, () => req.destroy(new Error('HTTP fixture timed out: ' + url)));
      req.on('error', reject);
      req.end();
    });
  }

  async function runFixture(bundle, mode, repo) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'madrasah-runtime-test-'));
    let child;
    let diagnostic = '';
    try {
      const dist = path.join(temporary, 'dist');
      fs.mkdirSync(dist);
      fs.writeFileSync(path.join(dist, 'server.cjs'), bundle);
      fs.writeFileSync(path.join(dist, 'server.cjs.map'), 'fixture server sourcemap');
      fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Fixture UI</title>');
      fs.writeFileSync(path.join(dist, 'fixture.js'), '/* public fixture asset */');
      if (mode === 'offline') {
        fs.writeFileSync(path.join(temporary, 'local_store.json'), JSON.stringify({ settings: { schoolName: 'Fixture School' } }));
      }
      const env = {
        PATH: process.env.PATH,
        NODE_PATH: path.join(repo, 'node_modules'),
        NODE_ENV: 'production',
        APP_MODE: mode === 'offline' ? 'offline' : 'online',
        PORT: '0',
        JWT_SECRET: 'fixture-only-session-secret',
        LOCAL_STORE_SECRET: 'fixture-only-storage-secret',
        TOKEN_LOCK_SECRET: 'fixture-only-token-secret',
      };
      if (mode === 'online-ready') {
        Object.assign(env, { SQL_HOST: '/cloudsql/fixture:region:instance', SQL_USER: 'fixture', SQL_PASSWORD: 'fixture' });
      }
      child = fork(__filename, ['--fixture-child', path.join(dist, 'server.cjs'), mode], {
        cwd: temporary, env, execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      child.stdout.on('data', data => { diagnostic += data; });
      child.stderr.on('data', data => { diagnostic += data; });
      const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('HTTP listener did not start')), 10000);
        child.once('message', message => { clearTimeout(timer); resolve(message.port); });
        child.once('exit', () => { clearTimeout(timer); reject(new Error('Fixture process exited before listening')); });
        child.once('error', error => { clearTimeout(timer); reject(error); });
      });
      assert.equal((await request(port, '/health')).status, 200);
      assert.equal((await request(port, '/')).status, 200);
      assert.equal((await request(port, '/fixture.js')).status, 200);
      for (const url of ['/server.cjs', '/server.cjs.map', '/%73erver.cjs', '/server%2Ecjs%2Emap']) {
        assert.equal((await request(port, url)).status, 404, 'Backend artifact exposed: ' + url);
        assert.equal((await request(port, url, 'HEAD')).status, 404);
      }
      if (mode !== 'online-pending') {
        // This API requires hydration. It hung indefinitely with the old OFFLINE cycle.
        let settings;
        for (let attempt = 0; attempt < 20; attempt++) {
          settings = await request(port, '/api/settings');
          if (settings.status === 200) break;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(settings.status, 200);
        assert.equal(JSON.parse(settings.body).settings.schoolName, 'Fixture School');
      } else {
        assert.equal((await request(port, '/api/settings')).status, 503);
      }
      const health = JSON.parse((await request(port, '/api/health')).body);
      assert.equal(health.ready, mode !== 'online-pending');
      assert.equal(health.hydrated, mode !== 'online-pending');
      assert.equal(health.dbConnected, mode === 'online-ready');
      assert.equal((await request(port, '/readyz')).status, mode === 'online-pending' ? 503 : 200);
      assert.ok(!diagnostic.includes('Uncaught Exception'), 'Uncaught exception in startup');
      console.log('Runtime HTTP smoke passed: ' + mode);
    } catch (error) {
      console.error(diagnostic.slice(-6000)); // Only the credential-free fixture process.
      throw error;
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        await new Promise(resolve => {
          const timer = setTimeout(() => { child.kill('SIGKILL'); }, 3000);
          child.once('exit', () => { clearTimeout(timer); resolve(); });
          child.kill('SIGTERM');
        });
      }
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }

  (async () => {
    const repo = path.resolve(__dirname, '..');
    const built = require('esbuild').buildSync({
      entryPoints: [path.join(repo, 'server.ts')],
      bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false,
      logLevel: 'silent',
    });
    const bundle = built.outputFiles[0].contents;
    for (const mode of ['offline', 'online-pending', 'online-ready']) await runFixture(bundle, mode, repo);
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
