import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { gameId, objective, targetBuilder, autonomous, maxIterations } = body;

  if (!objective) {
    return NextResponse.json({ error: "objective required" }, { status: 400 });
  }

  const { runWizardGraph } = await import("@/graphs/game-wizard-graph");

  // Fire and forget
  runWizardGraph({
    gameId,
    objective,
    targetBuilder,
    autonomous,
    maxIterations
  }).catch(console.error);

  return NextResponse.json({
    ok: true,
    message: "Graph started",
    objective
  });
}

export async function GET() {
  return NextResponse.json({
    status: "graph-ready",
    description: "LangGraph game wizard"
  });
}
