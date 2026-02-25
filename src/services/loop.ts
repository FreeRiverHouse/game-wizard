import fs from 'node:fs'
import path from 'node:path'
import { runBuild, runScreenshot, runGitCommit, runGitDiff } from './shell'
import { analyzeScreenshot, analyzeScreenshotLocal, generateCodeChanges, generateCodeChangesLocal, generatePMSummary } from './ai'
import { startMLXServer, stopMLXServer, VISION_SERVER, CODER_SERVER } from './mlx-manager'
import { getDb } from './db'
import { getActiveGameId, getGamePaths } from './game-context'
import type { LoopState, LoopOptions, AnalysisResult, CodeChange } from '@/lib/types'

// ── Singleton state (vive nel processo Next.js) ──

let _state: LoopState = 'idle'
let _currentIteration = 0
let _objective = ''
let _lastError: string | undefined
let _startedAt: string | undefined
let _abortController: AbortController | null = null
let _lastAnalysis: AnalysisResult | null = null
let _lastChanges: CodeChange[] = []
let _pendingApproval = false
let _resolveApproval: ((approved: boolean) => void) | null = null

// ── Event emitter leggero per SSE ──

type Listener = (event: string, data: string) => void
const _listeners: Set<Listener> = new Set()

export function addLoopListener(fn: Listener) { _listeners.add(fn) }
export function removeLoopListener(fn: Listener) { _listeners.delete(fn) }

function emit(event: string, data: string) {
  for (const fn of _listeners) {
    try { fn(event, data) } catch { /* listener disconnesso */ }
  }
}

function setState(s: LoopState) {
  _state = s
  emit('state', s)
}

// ── Public API ──

export function getLoopStatus() {
  return {
    state: _state,
    currentIteration: _currentIteration,
    objective: _objective,
    lastError: _lastError,
    startedAt: _startedAt,
    lastAnalysis: _lastAnalysis,
    lastChanges: _lastChanges,
    pendingApproval: _pendingApproval,
  }
}

export function stopLoop() {
  _abortController?.abort()
  _abortController = null
  if (_resolveApproval) {
    _resolveApproval(false)
    _resolveApproval = null
  }
  _pendingApproval = false
  setState('idle')
  emit('log', 'Loop stopped by user')
}

export function approveChanges(approved: boolean) {
  if (_resolveApproval) {
    _resolveApproval(approved)
    _resolveApproval = null
    _pendingApproval = false
  }
}

/**
 * Risolve il path assoluto di un file C# dato il nome (es. "BuildingBuilder.cs")
 */
function resolveFile(fileName: string, buildersDir: string, coreDir: string): string | null {
  const inBuilders = path.join(buildersDir, fileName)
  const inCore = path.join(coreDir, fileName)
  if (fs.existsSync(inBuilders)) return inBuilders
  if (fs.existsSync(inCore)) return inCore
  return null
}

/**
 * Esegue una singola iterazione interna del loop.
 * Restituisce true se completata con successo, false se abortita.
 */
async function runOneIteration(iterNum: number, options: LoopOptions): Promise<boolean> {
  const signal = _abortController!.signal
  // Copia mutabile per gestire fallback local→Claude runtime
  let useLocal = options.useLocalAI ?? false

  // ── Paths dinamici dal gioco attivo ──
  const gameId = getActiveGameId()
  const { gamePath, referenceImage, buildersDir, coreDir } = getGamePaths()

  emit('log', `=== ITERATION ${iterNum} [${gameId}] ===`)
  emit('log', `Objective: ${options.objective}`)

  const db = getDb()
  db.prepare(
    'INSERT INTO iterations (game_id, number, status, reference_path) VALUES (?, ?, ?, ?)'
  ).run(gameId, iterNum, 'building', referenceImage)

  // ── STEP 1: BUILD ──────────────────────────────────────────────────────────
  setState('building')
  emit('log', '[1/5] Building...')

  const buildResult = await runBuild(gamePath, signal)
  if (signal.aborted) return false
  if (!buildResult.success) throw new Error(`Build failed (exit ${buildResult.exitCode})`)
  emit('log', `Build OK in ${buildResult.durationMs}ms`)

  // ── STEP 2: SCREENSHOT ────────────────────────────────────────────────────
  setState('screenshotting')
  emit('log', '[2/5] Taking screenshot...')

  const ssResult = await runScreenshot(gamePath, signal)
  if (signal.aborted) return false
  if (!ssResult.success) throw new Error(`Screenshot failed (exit ${ssResult.exitCode})`)
  emit('log', `Screenshot → ${ssResult.screenshotPath}`)
  emit('screenshot', ssResult.screenshotPath || '')

  db.prepare('UPDATE iterations SET screenshot_path = ?, status = ? WHERE game_id = ? AND number = ?')
    .run(ssResult.archivePath || ssResult.screenshotPath, 'analyzing', 'pgr', iterNum)

  // ── STEP 3: ANALYZE (Vision) ──────────────────────────────────────────────
  const context = [
    `Iteration: ${iterNum}`,
    `Objective: ${options.objective}`,
    options.targetBuilder ? `Focus builder: ${options.targetBuilder}` : '',
  ].filter(Boolean).join('\n')

  if (useLocal) {
    // ── Avvia Qwen-Vision → analizza → spegni ──
    setState('loading_vision')
    emit('log', '[3/5] Avvio Qwen2.5-VL-7B (vision)...')
    try {
      await startMLXServer(VISION_SERVER, (msg) => emit('log', msg))
    } catch (err) {
      emit('log', `[warn] Vision server fallita: ${(err as Error).message} — fallback Claude`)
      useLocal = false
    }
  }

  if (!useLocal) {
    setState('analyzing')
    emit('log', '[3/5] AI analyzing screenshot vs reference (Claude)...')
  } else {
    setState('analyzing')
    emit('log', '[3/5] Confronto screenshot vs reference con Qwen-Vision...')
  }

  if (useLocal) {
    _lastAnalysis = await analyzeScreenshotLocal(
      ssResult.screenshotPath!, referenceImage, context,
      `http://127.0.0.1:${VISION_SERVER.port}`, VISION_SERVER.model
    )
    if (signal.aborted) { await stopMLXServer(VISION_SERVER.port); return false }
    emit('log', `[3/5] Spegnimento Qwen-Vision...`)
    await stopMLXServer(VISION_SERVER.port)
    emit('log', `[3/5] Qwen-Vision spento. RAM liberata.`)
  } else {
    _lastAnalysis = await analyzeScreenshot(ssResult.screenshotPath!, referenceImage, context)
    if (signal.aborted) return false
  }

  emit('log', `Analysis done (${_lastAnalysis.tokensUsed} tokens)`)
  emit('log', `Summary: ${_lastAnalysis.summary}`)
  emit('log', `Files: ${_lastAnalysis.suggestedFiles.join(', ')}`)
  emit('analysis', JSON.stringify(_lastAnalysis))

  db.prepare('UPDATE iterations SET ai_analysis = ?, ai_tokens_used = ?, status = ? WHERE game_id = ? AND number = ?')
    .run(JSON.stringify(_lastAnalysis), _lastAnalysis.tokensUsed, 'modifying', 'pgr', iterNum)

  // ── STEP 4: GENERATE CODE CHANGES (Coder) ────────────────────────────────
  if (useLocal) {
    setState('loading_coder')
    emit('log', '[4/5] Avvio Qwen3-Coder-30B (coder)...')
    try {
      await startMLXServer(CODER_SERVER, (msg) => emit('log', msg))
    } catch (err) {
      emit('log', `[warn] Coder server fallito: ${(err as Error).message} — fallback Claude`)
      useLocal = false
    }
  }

  setState('modifying')
  emit('log', useLocal
    ? '[4/5] Generazione codice con Qwen3-Coder...'
    : '[4/5] Generating code changes (Claude)...')

  const allChanges: CodeChange[] = []
  let totalTokens = _lastAnalysis.tokensUsed

  for (const suggestedFile of _lastAnalysis.suggestedFiles) {
    if (signal.aborted) {
      if (useLocal) await stopMLXServer(CODER_SERVER.port)
      return false
    }
    const actualPath = resolveFile(suggestedFile, buildersDir, coreDir)
    if (!actualPath) {
      emit('log', `File not found: ${suggestedFile} — skipping`)
      continue
    }
    const fileContent = fs.readFileSync(actualPath, 'utf-8')
    const result = useLocal
      ? await generateCodeChangesLocal(
          _lastAnalysis, fileContent, suggestedFile,
          `http://127.0.0.1:${CODER_SERVER.port}`, CODER_SERVER.model
        )
      : await generateCodeChanges(_lastAnalysis, fileContent, suggestedFile)
    allChanges.push(...result.changes)
    totalTokens += result.tokensUsed
    emit('log', `Generated ${result.changes.length} change(s) for ${suggestedFile}`)
  }

  // ── PM SUMMARY — genera riassunto high-level prima di spegnere il coder ──
  emit('log', '[4/5] Generating PM summary...')
  const pmSummary = await generatePMSummary(
    _lastAnalysis!,
    allChanges,
    useLocal ? `http://127.0.0.1:${CODER_SERVER.port}` : undefined,
    useLocal ? CODER_SERVER.model : undefined,
  )
  emit('log', `PM: ${pmSummary}`)

  if (useLocal) {
    emit('log', `[4/5] Spegnimento Qwen3-Coder...`)
    await stopMLXServer(CODER_SERVER.port)
    emit('log', `[4/5] Qwen3-Coder spento. RAM liberata.`)
  }

  _lastChanges = allChanges
  emit('changes', JSON.stringify(allChanges))
  emit('log', `Total: ${allChanges.length} code change(s)`)

  // Se autoCommit=false, aspetta approvazione dall'utente
  if (!options.autoCommit && allChanges.length > 0) {
    _pendingApproval = true
    emit('log', 'Waiting for approval...')
    emit('pending_approval', 'true')

    const approved = await new Promise<boolean>((resolve) => {
      _resolveApproval = resolve
      // Se l'utente abortisce, rifiuta automaticamente
      signal.addEventListener('abort', () => resolve(false), { once: true })
    })

    if (!approved) {
      emit('log', 'Changes rejected — skipping commit')
      db.prepare('UPDATE iterations SET status = ?, error = ? WHERE game_id = ? AND number = ?')
        .run('failed', 'Changes rejected by user', 'pgr', iterNum)
      return false
    }
  }

  if (signal.aborted) return false

  // Applica le modifiche ai file C#
  const modifiedFiles: string[] = []
  for (const change of allChanges) {
    const actualPath = resolveFile(change.filePath, buildersDir, coreDir)
    if (!actualPath) {
      emit('log', `Cannot resolve: ${change.filePath} — skipping`)
      continue
    }
    let content = fs.readFileSync(actualPath, 'utf-8')
    if (content.includes(change.oldCode)) {
      content = content.replace(change.oldCode, change.newCode)
      fs.writeFileSync(actualPath, content, 'utf-8')
      modifiedFiles.push(actualPath)
      emit('log', `Modified ${change.filePath}: ${change.description}`)
    } else {
      emit('log', `WARNING: oldCode not found in ${change.filePath}`)
    }
  }

  // ── STEP 5: COMMIT ────────────────────────────────────────────────────────
  setState('committing')
  emit('log', '[5/5] Committing...')

  if (modifiedFiles.length > 0) {
    const commitMsg = `iter ${iterNum}: ${options.objective.slice(0, 60)}`
    const gitResult = await runGitCommit(modifiedFiles, commitMsg, gamePath)
    const diff = await runGitDiff(gamePath, false)

    const durationMs = Date.now() - new Date(_startedAt!).getTime()
    db.prepare(
      `UPDATE iterations
       SET files_modified = ?, diff = ?, commit_hash = ?, commit_message = ?,
           ai_tokens_used = ?, status = ?, duration_ms = ?, pm_summary = ?
       WHERE game_id = ? AND number = ?`
    ).run(
      JSON.stringify(modifiedFiles.map(f => path.basename(f))),
      diff,
      gitResult.commitHash || null,
      commitMsg,
      totalTokens,
      'done',
      durationMs,
      pmSummary,
      gameId,
      iterNum
    )
    emit('log', `Committed ${gitResult.commitHash || '(no hash)'} — ${modifiedFiles.length} file(s)`)
  } else {
    emit('log', 'No files modified — skipping commit')
    db.prepare('UPDATE iterations SET status = ?, pm_summary = ? WHERE game_id = ? AND number = ?')
      .run('done', pmSummary, gameId, iterNum)
  }

  emit('done', `Iteration ${iterNum} complete`)
  emit('log', `=== ITERATION ${iterNum} COMPLETE ===`)
  return true
}

/**
 * Esegue il loop di self-improvement.
 * Se continuous=true gira finché STOP, altrimenti fino a maxIterations.
 * Fire-and-forget: viene chiamato senza await dalla API route.
 */
export async function runLoop(options: LoopOptions): Promise<void> {
  if (_state !== 'idle') return

  _objective = options.objective
  _startedAt = new Date().toISOString()
  _lastError = undefined
  _lastAnalysis = null
  _lastChanges = []
  _abortController = new AbortController()

  const db = getDb()
  const row = db.prepare('SELECT MAX(number) as maxN FROM iterations WHERE game_id = ?').get('pgr') as { maxN: number | null }
  _currentIteration = (row?.maxN || 0) + 1

  const maxIter = options.continuous ? Infinity : (options.maxIterations || 1)
  emit('log', `Starting loop: ${options.continuous ? 'continuous' : `max ${maxIter} iteration(s)`}`)

  let itersDone = 0
  while (itersDone < maxIter) {
    if (_abortController.signal.aborted) break

    try {
      const ok = await runOneIteration(_currentIteration, options)
      if (!ok || _abortController.signal.aborted) break
    } catch (err) {
      _lastError = String(err)
      emit('log', `ERROR: ${_lastError}`)
      db.prepare('UPDATE iterations SET status = ?, error = ? WHERE game_id = ? AND number = ?')
        .run('failed', _lastError, 'pgr', _currentIteration)
      break
    }

    itersDone++
    _currentIteration++

    // Pausa breve tra iterazioni continue
    if (itersDone < maxIter && !_abortController.signal.aborted) {
      emit('log', `--- Pausa 2s prima dell'iterazione ${_currentIteration} ---`)
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  setState('idle')
  emit('log', `Loop terminato dopo ${itersDone} iterazione/i`)
}

// Retrocompatibilità con il vecchio nome (usato dalla API route)
export const runIteration = runLoop
