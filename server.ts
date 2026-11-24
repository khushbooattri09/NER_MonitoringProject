import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import express from 'express';
import {createProxyMiddleware} from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
// Avoid port 8000 because the container control-plane sidecar binds :8000
const FASTAPI_HOST = '127.0.0.1';
const FASTAPI_PORT = Number(process.env.FASTAPI_PORT || 8001);
const FASTAPI_URL = `http://${FASTAPI_HOST}:${FASTAPI_PORT}`;

let fastApiReady = false;
let fastApiProcess: ChildProcess | null = null;
let fastApiStarting = false;
let shuttingDown = false;
let restartAttempts = 0;

function checkFastApiHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${FASTAPI_URL}/api/health`, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve(res.statusCode === 200 && body.includes('ner-landslide-fastapi'));
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function resolvePythonExecutable(): string | null {
  const venvPython = path.join(__dirname, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) {
    const check = spawnSync(venvPython, ['-c', 'import fastapi, uvicorn'], {stdio: 'ignore'});
    if (check.status === 0) return venvPython;
  }

  const sysCheck = spawnSync('python3', ['-c', 'import fastapi, uvicorn'], {stdio: 'ignore'});
  if (sysCheck.status === 0) return 'python3';

  return null;
}

async function bootstrapPythonEnvIfNeeded(): Promise<string | null> {
  const existing = resolvePythonExecutable();
  if (existing) return existing;

  console.log('[server] Python FastAPI environment not found; bootstrapping .venv...');
  const venvPython = path.join(__dirname, '.venv', 'bin', 'python');
  const reqFile = path.join(__dirname, 'backend', 'requirements.txt');

  return new Promise((resolve) => {
    const cmd = `python3 -m venv .venv && .venv/bin/pip install --upgrade pip -q && .venv/bin/pip install -r "${reqFile}" -q`;
    const installer = spawn('bash', ['-c', cmd], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {...process.env},
    });
    installer.stderr?.on('data', (d) => process.stderr.write(`[py-setup] ${d}`));
    installer.on('exit', (code) => {
      if (code === 0 && fs.existsSync(venvPython)) {
        console.log('[server] Python .venv bootstrapped successfully.');
        resolve(venvPython);
      } else {
        console.error(`[server] Python .venv bootstrap exited with code ${code}`);
        resolve(null);
      }
    });
    installer.on('error', () => resolve(null));
  });
}

async function ensureFastApiRunning(): Promise<void> {
  if (shuttingDown || fastApiStarting) return;

  const alreadyUp = await checkFastApiHealth();
  if (alreadyUp) {
    fastApiReady = true;
    restartAttempts = 0;
    return;
  }

  fastApiStarting = true;
  try {
    const pythonBin = await bootstrapPythonEnvIfNeeded();
    if (!pythonBin) {
      console.error('[server] No Python binary with FastAPI/Uvicorn available.');
      return;
    }

    console.log(`[server] Starting FastAPI (${pythonBin}) on ${FASTAPI_URL}...`);
    const child = spawn(
      pythonBin,
      ['-m', 'uvicorn', 'backend.main:app', '--host', FASTAPI_HOST, '--port', String(FASTAPI_PORT)],
      {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {...process.env},
      },
    );

    fastApiProcess = child;

    child.stdout?.on('data', (chunk) => {
      process.stdout.write(`[fastapi] ${chunk}`);
    });
    child.stderr?.on('data', (chunk) => {
      process.stderr.write(`[fastapi] ${chunk}`);
    });

    child.on('exit', (code, signal) => {
      fastApiReady = false;
      fastApiProcess = null;
      if (!shuttingDown) {
        restartAttempts += 1;
        const delayMs = Math.min(10000, 1500 * restartAttempts);
        console.warn(
          `[server] FastAPI exited (code=${code}, signal=${signal}); restarting in ${delayMs}ms...`,
        );
        setTimeout(() => {
          void ensureFastApiRunning();
        }, delayMs);
      }
    });

    child.on('error', (err) => {
      fastApiReady = false;
      console.error('[server] Failed to spawn FastAPI process:', err.message);
    });

    for (let i = 0; i < 60; i += 1) {
      if (await checkFastApiHealth()) {
        fastApiReady = true;
        restartAttempts = 0;
        console.log(`[server] FastAPI backend ready at ${FASTAPI_URL}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    console.warn('[server] FastAPI warm-up exceeded 30s; supervisor will continue monitoring.');
  } finally {
    fastApiStarting = false;
  }
}

const cleanup = () => {
  shuttingDown = true;
  if (fastApiProcess && !fastApiProcess.killed) {
    fastApiProcess.kill('SIGTERM');
  }
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

async function startServer(): Promise<void> {
  const app = express();

  // Ensure FastAPI is healthy or warming up when /api requests arrive
  app.use('/api', async (_req, res, next) => {
    if (!fastApiReady) {
      if (!fastApiStarting && !fastApiProcess) {
        void ensureFastApiRunning();
      }
      for (let i = 0; i < 10; i += 1) {
        if (await checkFastApiHealth()) {
          fastApiReady = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    if (!fastApiReady) {
      res.status(503).json({
        detail: 'FastAPI backend is starting up. Please retry in a moment.',
        reconnecting: true,
      });
      return;
    }
    next();
  });

  app.use(
    createProxyMiddleware({
      target: FASTAPI_URL,
      changeOrigin: true,
      pathFilter: '/api',
      on: {
        error: (_err, _req, res) => {
          fastApiReady = false;
          if (!fastApiStarting && !fastApiProcess) {
            void ensureFastApiRunning();
          }
          if ('writeHead' in res && typeof res.writeHead === 'function' && !res.headersSent) {
            res.writeHead(503, {'Content-Type': 'application/json'});
            res.end(
              JSON.stringify({
                detail: 'FastAPI backend temporarily disconnected; reconnecting automatically.',
                reconnecting: true,
              }),
            );
          }
        },
      },
    }),
  );

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Application running on http://0.0.0.0:${PORT}`);
    void ensureFastApiRunning();

    // Periodic watchdog check every 15s to auto-recover if FastAPI ever drops
    setInterval(() => {
      if (shuttingDown) return;
      void checkFastApiHealth().then((ok) => {
        fastApiReady = ok;
        if (!ok && !fastApiStarting && !fastApiProcess) {
          console.warn('[server] Watchdog detected FastAPI offline; restarting...');
          void ensureFastApiRunning();
        }
      });
    }, 15000);
  });
}

startServer().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
