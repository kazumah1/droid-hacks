// AI text-to-voxel generation using Claude
import Anthropic from '@anthropic-ai/sdk';

export interface Voxel {
  x: number;
  y: number;
  z: number;
}

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

export async function generateShapeFromText(command: string): Promise<Voxel[]> {
  // Simple fallback: small 3x3x3 pyramid if AI fails
  const fallback: Voxel[] = [];
  for (let y = 0; y < 3; y++) {
    const size = 3 - y;
    const offset = Math.floor((3 - size) / 2);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        fallback.push({ x: offset + i, y, z: offset + j });
      }
    }
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('Missing ANTHROPIC_API_KEY');
      return fallback;
    }

    const client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true, // Required for client-side usage
    });

    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: `${SYSTEM_PROMPT}\n\nUser command: ${command}` },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Try to parse JSON from the response
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return fallback;
    const json = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const voxels = (json.voxels || []) as Voxel[];

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
    return fallback;
  }
}

