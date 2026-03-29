/**
 * Model Registry — endpoint configurabili per ogni agente.
 *
 * Local:  CODER_URL non settato  → usa LM Studio localhost
 * Remote: CODER_URL=http://mac2.local:1234 → usa Mac esterna
 *
 * Ogni modello è indipendente: puoi mixare locale + remoto.
 */

export type AgentRole = 'planner' | 'coder' | 'vision' | 'book-editor'

export interface ModelEndpoint {
  url: string
  model: string
  /** 'local' = caricato da LM Studio CLI | 'remote' = già in ascolto su URL esterno */
  location: 'local' | 'remote'
  /** Comando LM Studio per caricare il modello (solo se location==='local') */
  lmsModelId?: string
}

function endpoint(
  envUrl: string | undefined,
  localUrl: string,
  envModel: string | undefined,
  defaultModel: string,
  lmsModelId?: string
): ModelEndpoint {
  const isRemote = !!envUrl
  return {
    url:        envUrl || localUrl,
    model:      envModel || defaultModel,
    location:   isRemote ? 'remote' : 'local',
    lmsModelId: isRemote ? undefined : lmsModelId,
  }
}

export const ModelRegistry: Record<AgentRole, ModelEndpoint> = {
  planner: endpoint(
    process.env.PLANNER_URL,
    'http://localhost:1234',
    process.env.PLANNER_MODEL,
    'mlx-qwen3.5-27b-claude-4.6-opus-reasoning-distilled-v2',
    'Jackrong/MLX-Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-v2-4bit'
  ),

  coder: endpoint(
    process.env.CODER_URL,
    'http://localhost:1234',
    process.env.CODER_MODEL,
    'qwen3-coder-30b-a3b-instruct-mlx',
    'lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-MLX-4bit'
  ),

  vision: endpoint(
    process.env.VISION_URL,
    'http://localhost:8081',
    process.env.VISION_MODEL,
    '/Volumes/SSD-FRH-1/Free-River-House/LOCAL-LLM/mlx-community/Qwen2.5-VL-7B-Instruct-4bit'
    // vision è MLX diretto, niente lmsModelId
  ),

  'book-editor': endpoint(
    process.env.BOOK_EDITOR_URL,
    'http://localhost:1234',
    process.env.BOOK_EDITOR_MODEL,
    'mistral-7b-instruct',
    undefined // da definire quando integriamo book-wizard
  ),
}

/** Ritorna true se il modello è su una macchina remota (non serve caricarlo) */
export function isRemote(role: AgentRole): boolean {
  return ModelRegistry[role].location === 'remote'
}
