import { spawn, ChildProcess, execSync } from 'node:child_process'
import path from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// Config modelli locali
// ─────────────────────────────────────────────────────────────────────────────

const MLX_ENV = process.env.MLX_ENV_PATH || `${process.env.HOME}/mlx-env`

// mlx-openai-server: unico binary che supporta sia LM che multimodal con --model-path
const MLX_OPENAI_SERVER = path.join(MLX_ENV, 'bin', 'mlx-openai-server')
// mlx_lm.server: binary dedicato ai modelli testo-only
const MLX_LM_SERVER = path.join(MLX_ENV, 'bin', 'mlx_lm.server')

export const VISION_SERVER = {
  model: process.env.LOCAL_VISION_MODEL || 'mlx-community/Qwen2.5-VL-7B-Instruct-4bit',
  port: parseInt(process.env.LOCAL_VISION_PORT || '8081'),
  modelType: 'multimodal' as const,  // mlx-openai-server launch --model-type multimodal
}

export const CODER_SERVER = {
  model: process.env.LOCAL_CODER_MODEL || 'mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit',
  port: parseInt(process.env.LOCAL_CODER_PORT || '8080'),
  modelType: 'lm' as const,          // mlx_lm.server --model
}

// ─────────────────────────────────────────────────────────────────────────────
// Processo tracker
// ─────────────────────────────────────────────────────────────────────────────

const _procs = new Map<number, ChildProcess>()

// ─────────────────────────────────────────────────────────────────────────────
// startMLXServer — avvia il server e aspetta che sia pronto
// Prima esecuzione: scarica il modello da HuggingFace (~GB, ci vuole tempo)
// ─────────────────────────────────────────────────────────────────────────────

export async function startMLXServer(
  config: { model: string; port: number; modelType: 'lm' | 'multimodal' },
  onLog?: (msg: string) => void,
  timeoutMs = 600_000  // 10 min — prima volta scarica il modello
): Promise<void> {
  const label = config.modelType === 'multimodal' ? 'VISION' : 'CODER'
  onLog?.(`[mlx] Avvio ${label} — ${config.model}`)
  onLog?.(`[mlx] Porta: ${config.port} (prima run carica il modello, può richiedere minuti)`)

  // Pulisci eventuali processi orfani sulla porta
  await stopMLXServer(config.port)

  const envPath = `${path.join(MLX_ENV, 'bin')}:${process.env.PATH}`

  // mlx_vlm.server NON accetta --model → usiamo mlx-openai-server per vision
  // mlx_lm.server accetta --model direttamente → usato per il coder
  let executable: string
  let args: string[]
  if (config.modelType === 'multimodal') {
    executable = MLX_OPENAI_SERVER
    args = ['launch', '--model-path', config.model, '--model-type', 'multimodal', '--port', String(config.port)]
  } else {
    executable = MLX_LM_SERVER
    args = ['--model', config.model, '--port', String(config.port)]
  }

  const proc = spawn(executable, args, {
    env: { ...process.env, PATH: envPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  _procs.set(config.port, proc)

  proc.stdout?.on('data', (d: Buffer) => {
    const msg = d.toString().trim()
    if (msg) onLog?.(`[mlx:${config.port}] ${msg}`)
  })
  proc.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString().trim()
    if (msg) onLog?.(`[mlx:${config.port}] ${msg}`)
  })
  proc.on('exit', (code) => {
    _procs.delete(config.port)
    if (code !== null && code !== 0) onLog?.(`[mlx:${config.port}] Processo terminato (exit ${code})`)
  })

  // Polling finché il server risponde su /v1/models
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${config.port}/v1/models`, {
        signal: AbortSignal.timeout(3000),
      })
      if (r.ok) {
        onLog?.(`[mlx] ✓ Server pronto su porta ${config.port}`)
        return
      }
    } catch { /* non ancora pronto */ }
    await new Promise(r => setTimeout(r, 4000))
  }

  await stopMLXServer(config.port)
  throw new Error(`[mlx] Timeout: server su porta ${config.port} non risponde dopo ${timeoutMs / 60000}min`)
}

// ─────────────────────────────────────────────────────────────────────────────
// stopMLXServer — termina il processo e libera RAM
// ─────────────────────────────────────────────────────────────────────────────

export async function stopMLXServer(port: number): Promise<void> {
  const proc = _procs.get(port)
  if (proc) {
    proc.kill('SIGTERM')
    _procs.delete(port)
    await new Promise(r => setTimeout(r, 1500))
  }
  // Kill forzato di eventuali processi rimasti sulla porta
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'pipe' })
  } catch { /* nessun processo */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// isServerRunning — check rapido
// ─────────────────────────────────────────────────────────────────────────────

export async function isServerRunning(port: number): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/v1/models`, { signal: AbortSignal.timeout(1500) })
    return r.ok
  } catch { return false }
}
