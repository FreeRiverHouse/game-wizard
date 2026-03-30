import fs from 'node:fs'
import path from 'node:path'
import { runBuild, runGitCommit, runGitDiff } from './shell'
import { analyzeScreenshotLocal, generateCodeChangesLocal, generatePMSummary } from './ai'
import { ensureModel, releaseModel, setOrchestratorLogger } from './model-orchestrator'
import { getDb } from './db'
import { getActiveGameId, getGamePaths } from './game-context'
import type { LoopState, LoopOptions, AnalysisResult, CodeChange } from '@/lib/types'
import { generateNextObjective } from './planner'
import { runGameTest } from './game-tester'
import { getOndeFlowState } from './onde-flow-state'
import { updateAppState } from '@/lib/app-registry'
import { PGR_GAMEPLAY_SCENARIO } from './test-scenarios'

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

  // Mark active app as coder-stopped
  try {
    const ofState = getOndeFlowState()
    if (ofState.activeApp) {
      updateAppState(ofState.activeApp, { coderStopped: true, timestamp: new Date().toISOString() })
    }
  } catch { /* non-fatal */ }
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

  // ── Paths dinamici dal gioco attivo ──
  const gameId = getActiveGameId()
  const { gamePath, referenceImage, buildersDir, coreDir } = getGamePaths()
  const screenshotsDir = path.join(gamePath, 'screenshots')

  emit('log', `=== ITERATION ${iterNum} [${gameId}] ===`)
  emit('log', `Objective: ${options.objective}`)

  const db = getDb()
  db.prepare(
    'INSERT INTO iterations (game_id, number, status, reference_path) VALUES (?, ?, ?, ?)'
  ).run(gameId, iterNum, 'building', referenceImage)

  // ── STEP 0: PLANNING (Autonomous mode) ────────────────────────────────────────
  if (options.autonomous === true) {
    setState('planning')
    emit('log', '[0/5] Planner: generazione prossimo obiettivo...')
    const planResult = await generateNextObjective((msg) => emit('log', msg))
    options.objective = planResult.objective
    if (planResult.targetBuilder) options.targetBuilder = planResult.targetBuilder
    emit('log', `[0/5] Obiettivo: ${planResult.objective} (area: ${planResult.area})`)
    emit('log', `[0/5] Reasoning: ${planResult.reasoning}`)
    emit('plan', JSON.stringify(planResult))
    _objective = planResult.objective
  }

  // ── STEP 1: BUILD ──────────────────────────────────────────────────────────
  setState('building')
  emit('log', '[1/5] Building...')

  const buildResult = await runBuild(gamePath, signal)
  if (signal.aborted) return false
  if (!buildResult.success) throw new Error(`Build failed (exit ${buildResult.exitCode})`)
  emit('log', `Build OK in ${buildResult.durationMs}ms`)

  // ── STEP 2: GAME TEST ────────────────────────────────────────────────────
  setState('screenshotting')
  emit('log', '[2/5] Running game test...')

  const testResult = await runGameTest(
    path.join(gamePath, 'Builds', 'PizzaGelatoRush.app'),
    PGR_GAMEPLAY_SCENARIO,
    screenshotsDir,
    (msg) => emit('log', msg)
  )
  if (signal.aborted) return false
  if (!testResult.success || testResult.screenshotPaths.length === 0) {
    throw new Error(`Game test failed: ${testResult.error || 'no screenshots'}`)
  }
  const screenshotPath = testResult.screenshotPaths[testResult.screenshotPaths.length - 1]
  emit('log', `Game test OK — ${testResult.screenshotPaths.length} screenshots`)
  emit('screenshot', screenshotPath)

  db.prepare('UPDATE iterations SET screenshot_path = ?, status = ? WHERE game_id = ? AND number = ?')
    .run(screenshotPath, 'analyzing', gameId, iterNum)

  // ── STEP 3: ANALYZE (Vision) ──────────────────────────────────────────────
  const context = [
    `Iteration: ${iterNum}`,
    `Objective: ${options.objective}`,
    options.targetBuilder ? `Focus builder: ${options.targetBuilder}` : '',
  ].filter(Boolean).join('\n')

  setState('loading_vision')
  emit('log', '[3/5] Caricamento vision model...')
  const { url: visionUrl, model: visionModel } = await ensureModel('vision')
  setState('analyzing')
  emit('log', '[3/5] Analisi screenshot con vision locale...')
  _lastAnalysis = await analyzeScreenshotLocal(screenshotPath, referenceImage, context, visionUrl, visionModel)
  if (signal.aborted) { await releaseModel(); return false }
  emit('log', '[3/5] Vision done. RAM liberata al prossimo swap.')

  emit('log', `Analysis done (${_lastAnalysis.tokensUsed} tokens)`)
  emit('log', `Summary: ${_lastAnalysis.summary}`)
  emit('log', `Files: ${_lastAnalysis.suggestedFiles.join(', ')}`)
  emit('analysis', JSON.stringify(_lastAnalysis))

  db.prepare('UPDATE iterations SET ai_analysis = ?, ai_tokens_used = ?, status = ? WHERE game_id = ? AND number = ?')
    .run(JSON.stringify(_lastAnalysis), _lastAnalysis.tokensUsed, 'modifying', gameId, iterNum)

  // ── STEP 4: GENERATE CODE CHANGES (Coder) ────────────────────────────────
  setState('loading_coder')
  emit('log', '[4/5] Caricamento coder model...')
  const { url: coderUrl, model: coderModel } = await ensureModel('coder')
  setState('modifying')
  emit('log', '[4/5] Generazione codice con Qwen3-Coder...')
  const allChanges: CodeChange[] = []
  let totalTokens = _lastAnalysis.tokensUsed

  for (const suggestedFile of _lastAnalysis.suggestedFiles) {
    if (signal.aborted) return false
    const actualPath = resolveFile(suggestedFile, buildersDir, coreDir)
    if (!actualPath) {
      emit('log', `File not found: ${suggestedFile} — skipping`)
      continue
    }
    const fileContent = fs.readFileSync(actualPath, 'utf-8')
    const result = await generateCodeChangesLocal(
      _lastAnalysis, fileContent, suggestedFile,
      coderUrl, coderModel
    )
    allChanges.push(...result.changes)
    totalTokens += result.tokensUsed
    emit('log', `Generated ${result.changes.length} change(s) for ${suggestedFile}`)
  }

  // ── PM SUMMARY — genera riassunto high-level prima di spegnere il coder ──
  emit('log', '[4/5] Generating PM summary...')
  const pmSummary = await generatePMSummary(
    _lastAnalysis!,
    allChanges,
    coderUrl,
    coderModel
  )
  emit('log', `PM: ${pmSummary}`)

  await releaseModel()
  emit('log', '[4/5] Modello rilasciato.')

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
        .run('failed', 'Changes rejected by user', gameId, iterNum)
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

  // Update active app STATE.json
  try {
    const ofState = getOndeFlowState()
    if (ofState.activeApp) {
      updateAppState(ofState.activeApp, {
        lastIter: iterNum,
        buildOk: buildResult.success,
        lastChange: pmSummary || null,
        coderStopped: false,
        timestamp: new Date().toISOString(),
      })
    }
  } catch { /* non-fatal */ }

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

  setOrchestratorLogger((msg) => emit('log', msg))

  const db = getDb()
  const row = db.prepare('SELECT MAX(number) as maxN FROM iterations WHERE game_id = ?').get(getActiveGameId()) as { maxN: number | null }
  _currentIteration = (row?.maxN || 0) + 1

  const maxIter = options.continuous ? Infinity : (options.maxIterations || 1)
  emit('log', `Starting loop: ${options.continuous ? 'continuous' : `max ${maxIter} iteration(s)`}`)

  let itersDone = 0
  let lastChangeCount = -1
  let zeroChangeCount = 0

  while (itersDone < maxIter) {
    if (_abortController.signal.aborted) break

    try {
      // Se in modalità autonomo, imposta continuous=true e objective='autonomous'
      if (options.autonomous === true) {
        options.continuous = true
        options.objective = 'autonomous'
      }

      const ok = await runOneIteration(_currentIteration, options)
      if (!ok || _abortController.signal.aborted) break
    } catch (err) {
      _lastError = String(err)
      emit('log', `ERROR: ${_lastError}`)
      db.prepare('UPDATE iterations SET status = ?, error = ? WHERE game_id = ? AND number = ?')
        .run('failed', _lastError, getActiveGameId(), _currentIteration)
      break
    }

    // Controllo per warning di zero changes consecutivi in modalità autonomo
    if (options.autonomous === true) {
      const currentChangeCount = _lastChanges.length
      if (currentChangeCount === 0) {
        zeroChangeCount++
        if (zeroChangeCount >= 3 && lastChangeCount === 0) {
          emit('log', '⚠️ WARNING: 3 iterazioni consecutive senza modifiche in modalità autonomo')
        }
      } else {
        zeroChangeCount = 0
      }
      lastChangeCount = currentChangeCount
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