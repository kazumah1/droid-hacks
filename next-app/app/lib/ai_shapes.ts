// lib/ai_shapes.ts
import Anthropic from '@anthropic-ai/sdk';
import type { Vector3 } from './types';

const CELL_SIZE = 0.6;
const GRID_MIN = 0;
const GRID_MAX = 49;
const MIN_VOXELS = 180;

const SYSTEM_PROMPT = `You are a shape generator for a programmable matter simulator.

The world is a 3D voxel grid (0-49 on each axis). Given a short command like "pyramid 4" or "sphere 8", respond with ONLY a JSON object describing the shape via compact primitives.

Format:
{
  "voxels": [
    {"x": 0, "y": 0, "z": 0}
  ],
  "shapes": [
    {
      "type": "box",
      "origin": [10, 0, 10],
      "size": [8, 4, 8],
      "shell": false,
      "thickness": 2
    }
  ]
}

Guidelines:
- The final structure must be connected and gravity-respecting (y=0 is ground).
- Use SHAPES to describe large solids or shells. Only emit explicit voxels for details that primitives can't capture (keep explicit lists under 50 entries).
- A box has "origin" (inclusive) and "size". "shell": true means the box is hollow and the walls must be "thickness" voxels thick (>=2).
- The expanded structure must contain AT LEAST 180 voxels so it renders dense.
- All coordinates must be integers between 0 and 49.
- Do NOT wrap the JSON in code fences or add commentary.`;

export async function generateShapeFromText(prompt: string): Promise<Vector3[]> {
  // 1. Simple keyword-based fallback without LLM
  const lower = prompt.toLowerCase();
  if (!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY) {
    if (lower.includes('wall')) return generateFallbackWall();
    return generateFallbackPyramid();
  }

  try {
    const coords = await callAnthropicForVoxels(prompt);
    if (!coords || coords.length === 0) {
      return lower.includes('wall') ? generateFallbackWall() : generateFallbackPyramid();
    }
    const dense = densifyCoords(coords, MIN_VOXELS);
    return dense.map((c) => ({
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

const NEIGHBOR_OFFSETS: RawCoord[] = [];
for (let dx = -1; dx <= 1; dx++) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dy === 0 && dz === 0) continue;
      NEIGHBOR_OFFSETS.push({ x: dx, y: dy, z: dz });
    }
  }
}

function clampCoord(value: number) {
  return Math.max(GRID_MIN, Math.min(GRID_MAX, Math.round(value)));
}

function normalizeCoords(coords: RawCoord[]): RawCoord[] {
  const seen = new Set<string>();
  const result: RawCoord[] = [];
  for (const coord of coords) {
    const normalized = {
      x: clampCoord(coord.x),
      y: clampCoord(coord.y),
      z: clampCoord(coord.z),
    };
    const key = `${normalized.x},${normalized.y},${normalized.z}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }
  return result;
}

function densifyCoords(coords: RawCoord[], minVoxels = MIN_VOXELS): RawCoord[] {
  const normalized = normalizeCoords(coords);
  if (normalized.length === 0) return normalized;
  if (normalized.length >= minVoxels) return normalized;

  const queue: RawCoord[] = [...normalized];
  const set = new Set(queue.map((v) => `${v.x},${v.y},${v.z}`));
  let idx = 0;

  while (set.size < minVoxels && idx < queue.length) {
    const base = queue[idx++];
    for (const offset of NEIGHBOR_OFFSETS) {
      const next = {
        x: base.x + offset.x,
        y: base.y + offset.y,
        z: base.z + offset.z,
      };
      if (
        next.x < GRID_MIN ||
        next.x > GRID_MAX ||
        next.y < GRID_MIN ||
        next.y > GRID_MAX ||
        next.z < GRID_MIN ||
        next.z > GRID_MAX
      ) {
        continue;
      }
      const key = `${next.x},${next.y},${next.z}`;
      if (!set.has(key)) {
        set.add(key);
        queue.push(next);
        if (set.size >= minVoxels) break;
      }
    }
  }

  return Array.from(set).map((key) => {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
  });
}

// Very simple Anthropic call
async function callAnthropicForVoxels(prompt: string): Promise<RawCoord[]> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('Missing NEXT_PUBLIC_ANTHROPIC_API_KEY');
      return [];
    }

    const client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: `${SYSTEM_PROMPT}\n\nUser command: ${prompt}` }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return [];
    const json = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const voxels = (json.voxels || []) as RawCoord[];

    return normalizeCoords(voxels);
  } catch (e) {
    console.error('AI shape error', e);
    return [];
  }
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
