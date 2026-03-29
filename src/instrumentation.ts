import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';

let cleanupRegistered = false;
let vibeProcess: ReturnType<typeof spawn> | null = null;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  try {
    execSync('lsof -ti:5001', { stdio: 'pipe' });
    console.log('[VibeVoice] server already running on :5001');
    return;
  } catch {
    // Port is free, continue
  }

  const serverPath = process.cwd() + '/scripts/vibevoice_server.py';
  if (!existsSync(serverPath)) {
    console.warn('[VibeVoice] vibevoice_server.py not found at:', serverPath);
    return;
  }

  console.log('[VibeVoice] TTS server starting on :5001...');

  vibeProcess = spawn('python3', ['scripts/vibevoice_server.py'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    detached: false,
    env: { ...process.env }
  });

  vibeProcess.stdout?.on('data', (data) => {
    console.log('[VibeVoice]', data.toString());
  });

  vibeProcess.stderr?.on('data', (data) => {
    console.log('[VibeVoice]', data.toString());
  });

  vibeProcess.on('error', (err) => {
    console.error('[VibeVoice] failed to start: ' + err.message);
  });

  vibeProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error('[VibeVoice] exited with code ' + code);
    }
  });

  const cleanup = () => {
    if (vibeProcess && !vibeProcess.killed) {
      vibeProcess.kill();
    }
  };

  if (!cleanupRegistered) {
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
    cleanupRegistered = true;
  }
}

