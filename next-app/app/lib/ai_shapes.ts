// lib/ai_shapes.ts
import type { Vector3 } from './types';

const CELL_SIZE = 0.6;

export async function generateShapeFromText(prompt: string): Promise<Vector3[]> {
  // 1. Simple keyword-based fallback without LLM
  const lower = prompt.toLowerCase();
  if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
    if (lower.includes('wall')) return generateFallbackWall();
    return generateFallbackPyramid();
  }

  try {
    const coords = await callOpenAIForVoxels(prompt);
    if (!coords || !Array.isArray(coords) || coords.length === 0) {
      return lower.includes('wall') ? generateFallbackWall() : generateFallbackPyramid();
    }
    // Map integer grid coords to world coords
    return coords.map((c) => ({
      x: c.x * CELL_SIZE,
      y: c.y * CELL_SIZE,
      z: c.z * CELL_SIZE,
    }));
  } catch (e) {
    console.error('AI shape error, using fallback', e);
    return lower.includes('wall') ? generateFallbackWall() : generateFallbackPyramid();
  }
}

interface RawCoord {
  x: number;
  y: number;
  z: number;
}

// Very simple raw OpenAI call
async function callOpenAIForVoxels(prompt: string): Promise<RawCoord[]> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY!;
  const systemPrompt = `
You are a shape planner for a programmable matter swarm. 
Given a user command, output a JSON array of integer coordinates in a 10x10x10 grid, like:
[{ "x": 0, "y": 0, "z": 0 }, ...]
Do NOT include any extra text, only raw JSON.
Prefer grounded structures (start y=0) and avoid floating blocks.
`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // or whatever is available at the hackathon
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() ?? '[]';

  // Extract JSON (in case it wraps it in ```json ...)
  const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '');
  const parsed = JSON.parse(jsonStr);
  return parsed as RawCoord[];
}

/**
 * Simple fallback pyramid: 4x4 base, 3 levels
 */
function generateFallbackPyramid(): Vector3[] {
  const positions: Vector3[] = [];
  const levels = 4;

  for (let level = 0; level < levels; level++) {
    const size = levels - level;
    const offset = (size - 1) / 2;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const x = (i - offset) * CELL_SIZE;
        const z = (j - offset) * CELL_SIZE;
        const y = level * CELL_SIZE;
        positions.push({ x, y, z });
      }
    }
  }
  return positions;
}

/**
 * Simple fallback wall: width x height
 */
function generateFallbackWall(): Vector3[] {
  const positions: Vector3[] = [];
  const width = 8;
  const height = 3;
  const startX = -((width - 1) * CELL_SIZE) / 2;
  const z = -3;

  for (let i = 0; i < width; i++) {
    for (let h = 0; h < height; h++) {
      positions.push({
        x: startX + i * CELL_SIZE,
        y: h * CELL_SIZE,
        z,
      });
    }
  }
  return positions;
}
