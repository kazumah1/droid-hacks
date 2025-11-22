// lib/ai_shapes.ts
import Anthropic from '@anthropic-ai/sdk';
import type { Vector3 } from './types';

const CELL_SIZE = 0.6;
const SYSTEM_PROMPT = `You are a shape generator for a programmable matter simulator.

The world is a 3D voxel grid with x, y, z coordinates ranging from 0 to 9 (inclusive).
Given a short natural language command (like "pyramid 4" or "wall 6x3"),
you must respond with a JSON object ONLY, with this shape:

{
  "voxels": [
    {"x": 0, "y": 0, "z": 0},
    ...
  ]
}

Rules:
- voxels must form a single connected structure.
- do not exceed a 10x10x10 grid (0–9).
- y=0 is the ground.
- For a pyramid N, produce a stepped pyramid with N levels.
- For a wall W x H, produce a vertical wall with width and height.
- Never include any extra keys or commentary, only the JSON object.`;

export async function generateShapeFromText(prompt: string): Promise<Vector3[]> {
  // 1. Simple keyword-based fallback without LLM
  const lower = prompt.toLowerCase();
  if (!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY) {
    if (lower.includes('wall')) return generateFallbackWall();
    return generateFallbackPyramid();
  }

  try {
    const coords = await callAnthropicForVoxels(prompt);
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
async function callAnthropicForVoxels(prompt: string): Promise<RawCoord[]> {
    try {
        const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
        if (!apiKey) {
        console.error('Missing ANTHROPIC_API_KEY');
        return [];
        }
        
        const client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true, // Required for client-side usage
        });

        const message = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
            { role: 'user', content: `${SYSTEM_PROMPT}\n\nUser command: ${prompt}` },
        ],
        });

        const text = message.content[0].type === 'text' ? message.content[0].text : '';
        
        // Try to parse JSON from the response
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) return [];
        const json = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
        const voxels = (json.voxels || []) as Vector3[];

        // sanitize / clamp
        return voxels
        .filter(v => v && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number')
        .map(v => ({
            x: Math.max(0, Math.min(9, Math.round(v.x))),
            y: Math.max(0, Math.min(9, Math.round(v.y))),
            z: Math.max(0, Math.min(9, Math.round(v.z))),
        }));
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
