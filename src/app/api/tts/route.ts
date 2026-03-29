import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<Response> {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { text, voice } = body;

  if (!text) {
    return NextResponse.json({ error: 'no text' }, { status: 400 });
  }

  let pythonResp;
  try {
    pythonResp = await fetch('http://localhost:5001/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice }),
    });
  } catch (e) {
    return NextResponse.json({ error: 'TTS server not running' }, { status: 503 });
  }

  if (!pythonResp.ok) {
    return NextResponse.json({ error: 'TTS failed' }, { status: 502 });
  }

  return new Response(await pythonResp.arrayBuffer(), {
    headers: {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'no-cache',
    },
  });
}

