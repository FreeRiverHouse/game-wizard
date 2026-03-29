// ── Result types ──

export interface ShellResult {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
}

export interface BuildResult extends ShellResult {
  success: boolean
  appPath?: string
}

export interface ScreenshotResult extends ShellResult {
  success: boolean
  screenshotPath?: string  // /tmp/pgr_zoom.png
  archivePath?: string     // screenshots/YYYYMMDD_HHMMSS_zoom.png
}

export interface GitStatus {
  branch: string
  clean: boolean
  modified: string[]
  untracked: string[]
}

export interface GitLogEntry {
  hash: string
  message: string
  date: string
  author: string
}

export interface GitResult extends ShellResult {
  commitHash?: string
}

// ── Builder types ──

export interface BuilderParam {
  name: string        // "HeightMin"
  type: 'float' | 'Color' | 'int' | 'bool' | 'string'
  value: string       // "7f" o "(0.96f, 0.50f, 0.12f)"
  line: number        // riga nel file C#
  access: string      // "public static" | "static" | "static readonly"
}

export interface BuilderInfo {
  name: string        // "BuildingBuilder"
  filePath: string    // percorso relativo da GAME_PATH
  category: string    // "urban" | "flora" | "props" | "environment" | "characters"
  params: BuilderParam[]
  description: string
  lastModified: string
}

// ── Loop types ──

export type LoopState = 'idle' | 'building' | 'screenshotting' | 'loading_vision' | 'analyzing' | 'loading_coder' | 'modifying' | 'committing' | 'planning'

export interface LoopStatus {
  state: LoopState
  currentIteration: number
  objective: string
  lastError?: string
  startedAt?: string
}

export interface LoopOptions {
  maxIterations: number
  continuous: boolean
  autoCommit: boolean
  targetBuilder?: string
  objective: string
  autonomous?: boolean  // true = planner genera objectives automaticamente
}

export interface PlannerResult {
  objective: string
  targetBuilder?: string
  reasoning: string
  area: 'urban' | 'flora' | 'props' | 'environment' | 'characters' | 'general'
}

// ── AI types ──

export interface AnalysisResult {
  gaps: { element: string; current: string; target: string; fix: string }[]
  summary: string
  suggestedFiles: string[]
  tokensUsed: number
}

export interface CodeChange {
  filePath: string
  oldCode: string
  newCode: string
  description: string
}

// ── DB row types ──

export interface GameRow {
  id: string
  name: string
  path: string
  build_script: string
  screenshot_script: string
  reference_image: string | null
  created_at: string
}

export interface IterationRow {
  id: number
  game_id: string
  number: number
  screenshot_path: string | null
  reference_path: string | null
  ai_analysis: string | null
  files_modified: string | null
  diff: string | null
  commit_hash: string | null
  commit_message: string | null
  status: string
  error: string | null
  ai_tokens_used: number
  duration_ms: number | null
  created_at: string
}

export interface OperationLogRow {
  id: number
  game_id: string | null
  operation: string
  details: string | null
  duration_ms: number | null
  status: string | null
  created_at: string
}
