import { readFileSync } from 'fs'
import { homedir } from 'os'

export async function GET(): Promise<Response> {
  try {
    const key = readFileSync(`${homedir()}/.ssh/id_ed25519.pub`, 'utf8').trim()
    return new Response(key + '\n', {
      headers: { 'Content-Type': 'text/plain' }
    })
  } catch {
    return new Response('key not found', { status: 404 })
  }
}
