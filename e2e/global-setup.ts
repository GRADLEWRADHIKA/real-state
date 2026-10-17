import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

/**
 * Starts a private demo API (fresh temporary database and upload folder) and the app's Vite server
 * on free ports, so the suite never touches anyone's real data or a running dev server.
 */
const appDir = path.resolve(import.meta.dirname, '..');
// The phone tests start a demo copy of estateflow-backend from the folder next to this one.
const backendDir = path.resolve(appDir, process.env.EF_BACKEND_DIR || '../estateflow-backend');
const bin = (name: string, dir = appDir) => path.join(dir, 'node_modules', '.bin', name);

/** Distinct free ports: all are held open together so the OS cannot hand out the same one twice. */
async function freePorts(n: number): Promise<number[]> {
  const servers = await Promise.all(
    Array.from(
      { length: n },
      () =>
        new Promise<net.Server>((resolve, reject) => {
          const srv = net.createServer();
          srv.on('error', reject);
          srv.listen(0, '127.0.0.1', () => resolve(srv));
        }),
    ),
  );
  const ports = servers.map((s) => (s.address() as net.AddressInfo).port);
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  return ports;
}

async function waitFor(url: string, proc: ChildProcess, label: string, timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (proc.exitCode !== null) throw new Error(`${label} exited with code ${proc.exitCode}`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${label} did not start at ${url}`);
}

function start(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, label: string) {
  const proc = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const log: string[] = [];
  const keep = (b: Buffer) => {
    log.push(b.toString());
    if (log.length > 200) log.shift();
  };
  proc.stdout?.on('data', keep);
  proc.stderr?.on('data', keep);
  proc.on('exit', (code, signal) => {
    if (!stopping) console.error(`[${label}] stopped unexpectedly (${signal ?? `exit ${code}`})\n${log.join('')}`);
  });
  return proc;
}

let stopping = false;

export default async function globalSetup() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'estateflow-e2e-'));
  const [apiPort, appPort] = await freePorts(2);

  const api = start(
    bin('tsx', backendDir),
    ['src/index.ts', '--demo'],
    backendDir,
    {
      PORT: String(apiPort),
      DEMO_DATABASE_FILE: path.join(tmp, 'demo.db'),
      UPLOAD_DIR: path.join(tmp, 'uploads'),
      RATE_LIMIT_AUTH: '1000',
      RATE_LIMIT_API: '100000',
      LOG_LEVEL: 'warn',
      TZ: 'Asia/Kolkata',
    },
    'api',
  );
  await waitFor(`http://127.0.0.1:${apiPort}/api/meta`, api, 'Demo API');

  const app = start(bin('vite'), ['--port', String(appPort), '--strictPort', '--host', '127.0.0.1'], appDir, { EF_API_PROXY: `http://127.0.0.1:${apiPort}`, EF_APP_PORT: String(appPort) }, 'app');
  await waitFor(`http://127.0.0.1:${appPort}/`, app, 'App dev server');

  process.env.E2E_BASE_URL = `http://127.0.0.1:${appPort}`;
  process.env.E2E_API_URL = `http://127.0.0.1:${apiPort}`;

  return async () => {
    stopping = true;
    app.kill('SIGTERM');
    api.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    fs.rmSync(tmp, { recursive: true, force: true });
  };
}
