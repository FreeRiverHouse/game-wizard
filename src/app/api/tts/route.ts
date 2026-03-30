import { NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import { readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

export async function POST(request: Request): Promise<Response> {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { text, voice = 'Samantha' } = body;
  if (!text) return NextResponse.json({ error: 'no text' }, { status: 400 });

  // Try VibeVoice first (fast timeout)
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 3000);
    const pythonResp = await fetch('http://localhost:5001/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (pythonResp.ok) {
      return new Response(await pythonResp.arrayBuffer(), {
        headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-cache' },
      });
    }
  } catch { /* fall through */ }

  // Microsoft Neural TTS via edge-tts
  const id = randomBytes(8).toString('hex');
  const mp3Path = join(tmpdir(), `tts-${id}.mp3`);
  const edgeVoice = voice === 'Samantha' ? 'en-US-JennyNeural' : voice;
  try {
    execFileSync('/opt/homebrew/bin/edge-tts', [
      '--voice', edgeVoice,
      '--text', text,
      '--write-media', mp3Path
    ], { timeout: 15000 });
    const audioData = readFileSync(mp3Path);
    return new Response(audioData, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' },
    });
  } catch {
    // Final fallback: macOS say
    const aiffPath = join(tmpdir(), `tts-${id}.aiff`);
    const wavPath = join(tmpdir(), `tts-${id}.wav`);
    try {
      execFileSync('/usr/bin/say', ['-v', 'Samantha', '-o', aiffPath, text], { timeout: 15000 });
      execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@22050', aiffPath, wavPath], { timeout: 10000 });
      const audioData = readFileSync(wavPath);
      return new Response(audioData, {
        headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-cache' },
      });
    } catch {
      return NextResponse.json({ error: 'TTS failed' }, { status: 503 });
    } finally {
      try { unlinkSync(aiffPath); } catch {}
      try { unlinkSync(wavPath); } catch {}
    }
  } finally {
    try { unlinkSync(mp3Path); } catch {}
  }
}
