import { NextResponse } from 'next/server';
import { getOndeFlowState, setMode, setActiveApp, startCoderSession, type OndeFlowMode } from '@/services/onde-flow-state';

export const dynamic = 'force-dynamic';

interface PostBody {
  mode?: OndeFlowMode;
  activeApp?: string | null;
  startCoder?: {
    app: string;
    tasks: string[];
  };
}

export function GET(): NextResponse {
  return NextResponse.json(getOndeFlowState());
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as PostBody;

  if (body.startCoder !== undefined) {
    startCoderSession(body.startCoder.app, body.startCoder.tasks);
  } else if (body.mode !== undefined) {
    setMode(body.mode);
  }

  if (body.activeApp !== undefined) {
    setActiveApp(body.activeApp);
  }

  return NextResponse.json(getOndeFlowState());
}
