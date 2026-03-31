export const dynamic = 'force-dynamic'

import { execFileSync } from 'child_process'

const SYSTEM = `You are Mattia Petrucciani, an indie game developer and creative director.
You are having a casual, real conversation with Emilio, your AI concierge inside Onde-Flow.

Your active projects:
- game-studio: Pizza Gelato Rush, a Unity mobile game with an AI self-improvement loop
- book-wizard: an EPUB pipeline for editing and exporting books

Speak as Mattia: short, casual Italian or English, 1-2 sentences max.
No greetings like "sure!" or "great!" — just natural conversation.
Respond ONLY with what Mattia says, no quotes, no prefix.`

export async function POST(request: Request): Promise<Response> {
  try {
    const { message, history = [] } = await request.json() as {
      message: string
      history?: { role: string; content: string }[]
    }

    const historyText = history.slice(-6).map(h =>
      `${h.role === 'mattia' ? 'Mattia' : 'Emilio'}: ${h.content}`
    ).join('\n')

    const prompt = `${SYSTEM}

${historyText ? `Conversation so far:\n${historyText}\n` : ''}
${message ? `Emilio just said: "${message}"\n` : ''}
Write exactly what Mattia says next (1-2 casual sentences):`

    const { ANTHROPIC_API_KEY: _removed, ...env } = process.env
    const raw = execFileSync('/Users/mattiapetrucciani/.local/bin/claude', ['-p', prompt], {
      encoding: 'utf8',
      timeout: 30000,
      env: {
        ...env,
        PATH: `/Users/mattiapetrucciani/.local/bin:/opt/homebrew/bin:${process.env.PATH ?? ''}`
      }
    }).trim()

    return Response.json({ reply: raw })
  } catch (err) {
    console.error('[mattia/chat]', err)
    return Response.json({ error: 'failed' }, { status: 500 })
  }
}
