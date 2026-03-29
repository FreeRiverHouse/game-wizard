import { execSync } from 'node:child_process';
import {
  startMLXServer,
  stopMLXServer,
  VISION_SERVER
} from './mlx-manager';

type ModelRole = 'coder' | 'vision' | 'planner';

let _loadedRole: ModelRole | null = null;
let _onLog: ((msg: string) => void) | null = null;

const LMS_PATH = `${process.env.HOME}/.local/bin/lms`;

export function setOrchestratorLogger(fn: (msg: string) => void): void {
  _onLog = fn;
}

function log(msg: string): void {
  if (_onLog) _onLog(msg);
}

async function waitForPort(port: number, timeoutMs = 90_000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = execSync(`curl -f http://localhost:${port}/v1/models`, {
        timeout: 3000,
        stdio: 'ignore'
      });
      if (result) break;
    } catch {
      // Ignore errors and continue waiting
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

export async function ensureModel(role: ModelRole): Promise<{ url: string; model: string }> {
  if (_loadedRole === role) {
    log(`Model ${role} already loaded`);
    _phase = 'running'; _phaseDetail = `${role} ready`;
    return _getModelInfo(role);
  }

  if (_loadedRole !== null) {
    await releaseModel();
  }

  _phase = 'loading'; _phaseDetail = `loading ${role}...`;

  try {
    switch (role) {
      case 'coder': {
        log('Loading coder model...');
        execSync(
          `${LMS_PATH} load qwen3-coder-30b-a3b-instruct-mlx --yes 2>&1`,
          { timeout: 120_000 }
        );
        log('Coder model loaded, waiting for server...');
        await waitForPort(1234);
        _loadedRole = role; _phase = 'running'; _phaseDetail = 'coder ready';
        return { url: 'http://localhost:1234', model: 'qwen3-coder-30b-a3b-instruct-mlx' };
      }
      case 'planner': {
        log('Loading planner model...');
        execSync(
          `${LMS_PATH} load mlx-qwen3.5-27b-claude-4.6-opus-reasoning-distilled-v2 --yes 2>&1`,
          { timeout: 120_000 }
        );
        log('Planner model loaded, waiting for server...');
        await waitForPort(1234);
        _loadedRole = role; _phase = 'running'; _phaseDetail = 'planner ready';
        return { url: 'http://localhost:1234', model: 'mlx-qwen3.5-27b-claude-4.6-opus-reasoning-distilled-v2' };
      }
      case 'vision': {
        log('Starting vision server...');
        await startMLXServer(VISION_SERVER, _onLog ?? undefined);
        _loadedRole = role;
        return { url: `http://127.0.0.1:${VISION_SERVER.port}`, model: VISION_SERVER.model };
      }
    }
  } catch (error) {
    log(`Error loading model ${role}: ${(error as Error).message}`);
    throw error;
  }

  // This should never happen due to switch exhaustiveness, but TypeScript needs it
  throw new Error(`Unknown role: ${role}`);
}

export async function releaseModel(): Promise<void> {
  if (_loadedRole === null) return;

  _phase = 'releasing'; _phaseDetail = `releasing ${_loadedRole}...`;

  try {
    switch (_loadedRole) {
      case 'coder':
      case 'planner': {
        log(`Releasing ${_loadedRole} model...`);
        execSync(`${LMS_PATH} unload --all 2>&1`, { timeout: 30_000 });
        break;
      }
      case 'vision': {
        log('Stopping vision server...');
        await stopMLXServer(VISION_SERVER.port);
        break;
      }
    }

    _loadedRole = null;
    _phase = 'idle'; _phaseDetail = '';
    log('Model released');
  } catch (error) {
    log(`Error releasing model: ${(error as Error).message}`);
  }
}

function _getModelInfo(role: ModelRole): { url: string; model: string } {
  switch (role) {
    case 'coder':
      return { url: 'http://localhost:1234', model: 'qwen3-coder-30b-a3b-instruct-mlx' };
    case 'planner':
      return { url: 'http://localhost:1234', model: 'mlx-qwen3.5-27b-claude-4.6-opus-reasoning-distilled-v2' };
    case 'vision':
      return { url: `http://127.0.0.1:${VISION_SERVER.port}`, model: VISION_SERVER.model };
  }
}

export function getLoadedModel(): ModelRole | null {
  return _loadedRole;
}

type OrchestratorPhase = 'idle' | 'loading' | 'running' | 'releasing';
let _phase: OrchestratorPhase = 'idle';
let _phaseDetail = '';

export function getOrchestratorStatus() {
  return {
    loadedModel: _loadedRole,      // 'coder' | 'planner' | 'vision' | null
    phase: _phase,                  // 'idle' | 'loading' | 'running' | 'releasing'
    detail: _phaseDetail,           // human-readable status
    // Convenience booleans for pipeline display
    pipeline: {
      gino:    'always-on',         // Gino uses claude CLI, always available
      planner: _loadedRole === 'planner' ? _phase : 'idle',
      coder:   _loadedRole === 'coder'   ? _phase : 'idle',
      vision:  _loadedRole === 'vision'  ? _phase : 'idle',
    }
  };
}

export function setOrchestratorPhase(phase: OrchestratorPhase, detail = ''): void {
  _phase = phase;
  _phaseDetail = detail;
  log(`[orchestrator] ${phase}: ${detail}`);
}