import { ensureModel } from './model-orchestrator';
import { getDb } from './db';
import { getActiveGameId } from './game-context';

export interface PlannerResult {
  objective: string;
  targetBuilder?: string;
  reasoning: string;
  area: 'urban' | 'flora' | 'props' | 'environment' | 'characters' | 'general';
}

export async function generateNextObjective(
  onLog?: (msg: string) => void
): Promise<PlannerResult> {
  try {
    const gameId = getActiveGameId();
    if (!gameId) {
      onLog?.('No active game ID found');
      return {
        objective: 'Improve overall visual quality',
        area: 'general',
        reasoning: 'No active game context available',
      };
    }

    const db = getDb();
    const iterations = db.prepare(
      `SELECT number, pm_summary, status, files_modified, created_at
       FROM iterations WHERE game_id = ?
       ORDER BY created_at DESC LIMIT 8`
    ).all(gameId);

    const history = iterations.map((iter: any) => ({
      iterationNumber: iter.number,
      summary: iter.pm_summary,
      status: iter.status,
      filesModified: iter.files_modified,
      createdAt: iter.created_at,
    }));

    const prompt = `
You are an expert game development planner focused on visual design improvements for Unity games.
The game is Pizza Gelato Rush — a casual racing game in Naples style (Horizon Chase style).
The goal is to make the game look as close as possible to a reference image with flat colors, vibrant, cartoon aesthetics.

Here is the history of recent iterations:
${JSON.stringify(history, null, 2)}

Available areas and their associated builders:
- urban: BuildingBuilder.cs, StreetRenderer.cs
- flora: PlantRenderer.cs, TreeBuilder.cs
- props: PropBuilder.cs, DecorationManager.cs
- environment: SkyboxRenderer.cs, TerrainGenerator.cs
- characters: CharacterAnimator.cs, SpriteRenderer.cs
- general: Any

Please analyze the history and suggest the next improvement objective.
Return ONLY valid JSON matching this exact structure:
{
  "objective": "string",
  "targetBuilder": "string (optional)",
  "reasoning": "1-2 sentences",
  "area": "urban" | "flora" | "props" | "environment" | "characters" | "general"
}

Focus on visual improvements that align with the flat colors, vibrant, cartoon style.
`;

    const { url, model } = await ensureModel('planner');
    if (!url) {
      onLog?.('Planner model URL not available');
      return {
        objective: 'Improve overall visual quality',
        area: 'general',
        reasoning: 'Planner unavailable',
      };
    }

    const response = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 800,
        temperature: 0.6,
      }),
    });

    const data = await response.json();
    let rawText: string = data.choices[0].message.content
    rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    const cleanResult = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed: PlannerResult;
    try {
      const match = cleanResult.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : cleanResult);
    } catch (e) {
      onLog?.(`Failed to parse planner response: ${cleanResult}`);
      return {
        objective: 'Improve overall visual quality',
        area: 'general',
        reasoning: 'Planner response could not be parsed',
      };
    }

    // Validate the result structure
    if (
      typeof parsed.objective !== 'string' ||
      typeof parsed.reasoning !== 'string' ||
      !['urban', 'flora', 'props', 'environment', 'characters', 'general'].includes(parsed.area)
    ) {
      onLog?.('Planner response did not match expected structure');
      return {
        objective: 'Improve overall visual quality',
        area: 'general',
        reasoning: 'Planner response structure invalid',
      };
    }

    return parsed;
  } catch (error) {
    onLog?.(`Planner error: ${error}`);
    return {
      objective: 'Improve overall visual quality',
      area: 'general',
      reasoning: 'Planner unavailable due to error',
    };
  }
}