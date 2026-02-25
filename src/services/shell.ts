import { execFile, spawn } from 'node:child_process'
import path from 'node:path'
import {
  GAME_PATH, BUILD_SCRIPT, SCREENSHOT_SCRIPT,
  BUILD_TIMEOUT, SCREENSHOT_TIMEOUT, GIT_TIMEOUT
} from '@/lib/constants'
import { logOperation } from './db'
import type { BuildResult, ScreenshotResult, ShellResult, GitStatus, GitLogEntry, GitResult } from '@/lib/types'

// ── Helper generico ──

function execShell(
  cmd: string,
  args: string[],
  opts: { cwd: string; timeout: number; signal?: AbortSignal }
): Promise<ShellResult> {
  return new Promise((resolve) => {
    const start = Date.now()
    execFile(cmd, args, {
      cwd: opts.cwd,
      timeout: opts.timeout,
      maxBuffer: 1024 * 1024 * 5, // 5MB
      signal: opts.signal,
    }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: error ? (error as NodeJS.ErrnoException).code === 'ERR_SOCKET_BAD_PORT' ? 1 : ((error as any).status ?? 1) : 0,
        durationMs: Date.now() - start,
      })
    })
  })
}

// ── Build ──

export async function runBuild(gamePath?: string, signal?: AbortSignal): Promise<BuildResult> {
  const gp = gamePath || GAME_PATH
  const result = await execShell('bash', [BUILD_SCRIPT], {
    cwd: gp,
    timeout: BUILD_TIMEOUT,
    signal,
  })
  const success = result.exitCode === 0
  const appPath = path.join(gp, 'Builds/PizzaGelatoRush.app')

  logOperation('pgr', 'build', { exitCode: result.exitCode }, result.durationMs, success ? 'success' : 'error')

  return { ...result, success, appPath: success ? appPath : undefined }
}

// ── Screenshot ──

export async function runScreenshot(gamePath?: string, signal?: AbortSignal): Promise<ScreenshotResult> {
  const gp = gamePath || GAME_PATH
  const result = await execShell('bash', [SCREENSHOT_SCRIPT], {
    cwd: gp,
    timeout: SCREENSHOT_TIMEOUT,
    signal,
  })
  const success = result.exitCode === 0

  // Estrai path archivio da stdout (riga tipo "📸 Archivio → screenshots/YYYYMMDD_HHMMSS_zoom.png")
  const archiveMatch = result.stdout.match(/screenshots\/(\S+\.png)/)
  const archivePath = archiveMatch ? path.join(gp, archiveMatch[0]) : undefined

  logOperation('pgr', 'screenshot', { exitCode: result.exitCode }, result.durationMs, success ? 'success' : 'error')

  return {
    ...result,
    success,
    screenshotPath: success ? '/tmp/pgr_zoom.png' : undefined,
    archivePath,
  }
}

// ── Git Status ──

export async function runGitStatus(gamePath?: string): Promise<GitStatus> {
  const gp = gamePath || GAME_PATH
  const result = await execShell('git', ['status', '--porcelain', '-b'], {
    cwd: gp,
    timeout: GIT_TIMEOUT,
  })
  const lines = result.stdout.trim().split('\n')
  const branchLine = lines[0] || ''
  const branch = branchLine.replace('## ', '').split('...')[0] || 'unknown'
  const modified: string[] = []
  const untracked: string[] = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    if (line.startsWith('??')) untracked.push(line.slice(3).trim())
    else modified.push(line.slice(3).trim())
  }
  return { branch, clean: modified.length === 0 && untracked.length === 0, modified, untracked }
}

// ── Git Log ──

export async function runGitLog(gamePath?: string, count = 10): Promise<GitLogEntry[]> {
  const gp = gamePath || GAME_PATH
  const result = await execShell('git', [
    'log', `--max-count=${count}`, '--format=%H|||%s|||%ai|||%an'
  ], { cwd: gp, timeout: GIT_TIMEOUT })

  return result.stdout.trim().split('\n').filter(Boolean).map(line => {
    const [hash, message, date, author] = line.split('|||')
    return { hash, message, date, author }
  })
}

// ── Git Commit ──

export async function runGitCommit(
  files: string[],
  message: string,
  gamePath?: string
): Promise<GitResult> {
  const gp = gamePath || GAME_PATH

  // Stage files
  const addResult = await execShell('git', ['add', ...files], {
    cwd: gp, timeout: GIT_TIMEOUT,
  })
  if (addResult.exitCode !== 0) {
    logOperation('pgr', 'commit', { error: addResult.stderr }, addResult.durationMs, 'error')
    return { ...addResult }
  }

  // Commit
  const commitResult = await execShell('git', ['commit', '-m', message], {
    cwd: gp, timeout: GIT_TIMEOUT,
  })

  const hashMatch = commitResult.stdout.match(/\[[\w/]+ ([a-f0-9]+)\]/)
  const commitHash = hashMatch ? hashMatch[1] : undefined

  const success = commitResult.exitCode === 0
  logOperation('pgr', 'commit', { hash: commitHash, files }, commitResult.durationMs, success ? 'success' : 'error')

  return { ...commitResult, commitHash }
}

// ── Git Push ──

export async function runGitPush(gamePath?: string): Promise<ShellResult> {
  const gp = gamePath || GAME_PATH
  return execShell('git', ['push'], { cwd: gp, timeout: 30_000 })
}

// ── Git Diff ──

export async function runGitDiff(gamePath?: string, staged = false): Promise<string> {
  const gp = gamePath || GAME_PATH
  const args = staged ? ['diff', '--staged'] : ['diff']
  const result = await execShell('git', args, { cwd: gp, timeout: GIT_TIMEOUT })
  return result.stdout
}

// ── Spawn per SSE streaming ──

export function spawnBuild(gamePath?: string): ReturnType<typeof spawn> {
  const gp = gamePath || GAME_PATH
  return spawn('bash', [BUILD_SCRIPT], { cwd: gp })
}

export function spawnScreenshot(gamePath?: string): ReturnType<typeof spawn> {
  const gp = gamePath || GAME_PATH
  return spawn('bash', [SCREENSHOT_SCRIPT], { cwd: gp })
}
