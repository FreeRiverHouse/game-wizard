import { NextResponse } from 'next/server'

const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://localhost:8080'
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'mlx-community/Qwen3-Coder-30B-A3B-Instruct-4bit'

export async function GET() {
  // Ping local MLX server
  let localOnline = false
  let localModel = LOCAL_LLM_MODEL

  try {
    const resp = await fetch(`${LOCAL_LLM_URL}/v1/models`, {
      signal: AbortSignal.timeout(2000),
    })
    if (resp.ok) {
      const data = await resp.json()
      localOnline = true
      localModel = data?.data?.[0]?.id || LOCAL_LLM_MODEL
    }
  } catch { /* server non attivo */ }

  // Controlla Claude
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY

  return NextResponse.json({
    local: {
      online: localOnline,
      url: LOCAL_LLM_URL,
      model: localModel,
      startCmd: `source ~/mlx-env/bin/activate && mlx_lm.server --model ${LOCAL_LLM_MODEL} --port 8080`,
    },
    claude: {
      available: hasApiKey,
      strategy: hasApiKey ? 'API Key' : 'OAuth Keychain / CLI',
    },
    activeBackend: localOnline ? 'local' : 'claude',
  })
}
