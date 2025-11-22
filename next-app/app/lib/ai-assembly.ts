// Enhanced AI assembly generation with component-based JSON output
import Anthropic from '@anthropic-ai/sdk';

export interface Voxel {
  x: number;
  y: number;
  z: number;
}

export type ShapePrimitive =
  | {
      type: 'box';
      origin: [number, number, number]; // inclusive
      size: [number, number, number];   // width (x), height (y), depth (z)
      shell?: boolean;                  // if true, only outer shell
      thickness?: number;               // shell thickness (default 1)
    };

export interface Component {
  id: string;
  name: string;
  description: string;
  voxels: Voxel[];
  shapes?: ShapePrimitive[];
  dependencies: string[];  // IDs of components that must be built first
  assemblyOrder: number;
}

export interface AssemblyPlan {
  name: string;
  description: string;
  gridSize: { x: number; y: number; z: number };
  totalVoxels: number;
  components: Component[];
  buildStrategy: string;
  estimatedTime: string;
}

const ASSEMBLY_SYSTEM_PROMPT = `You are an advanced assembly planner for programmable matter systems.

Given a natural language command describing a structure, generate a detailed assembly plan as JSON.

The world is a 3D voxel grid with coordinates ranging from 0 to 49 (inclusive).
- x, y, z are integers (0-49)
- y=0 is the ground
- Structures must be gravity-stable (blocks need support below)

You must respond with ONLY a valid JSON object in this exact format:

{
  "name": "Structure Name",
  "description": "Brief description of what this structure is",
  "gridSize": {"x": 49, "y": 49, "z": 49},
  "totalVoxels": 0,
  "components": [
    {
      "id": "component_1",
      "name": "Component Name",
      "description": "What this component represents",
      "shapes": [
        {
          "type": "box",
          "origin": [0, 0, 0],
          "size": [4, 2, 3],
          "shell": false
        }
      ],
      "voxels": [], // optional explicit voxels for irregular bits
      "dependencies": [],
      "assemblyOrder": 1
    }
  ],
  "buildStrategy": "Description of how to build this (e.g., 'bottom-up, foundation first')",
  "estimatedTime": "Estimated assembly time"
}

IMPORTANT RULES:
1. Break complex structures into logical components (foundation, walls, roof, etc.)
2. Each component should have meaningful voxels that form part of the structure
3. Prefer SHAPES over enumerating every voxel. Use box primitives to describe large solids/shells.
4. Only list explicit voxels for small or irregular details (<= 50 entries).
5. Use dependencies to ensure stable construction order
6. assemblyOrder starts at 1 and increments
7. Component IDs should be unique and descriptive (e.g., "foundation", "north_wall", "tower_base")
8. Total voxels should match the sum after shapes are expanded (assume solid fill unless shell=true)
9. All coordinates must be integers 0-49
10. Do NOT include any text outside the JSON object

Examples of good component breakdowns:
- Pyramid: base_layer, middle_layers, apex
- House: foundation, walls, roof
- Tower: base, shaft, top
- Bridge: left_support, deck, right_support

Be creative but practical. Think like an engineer planning an assembly sequence.`;

export async function generateAssemblyPlan(command: string): Promise<AssemblyPlan> {
  // Fallback: simple pyramid broken into components
  const fallbackPlan: AssemblyPlan = {
    name: 'Simple Pyramid',
    description: 'A 3-level pyramid structure',
    gridSize: { x: 49, y: 49, z: 49 },
    totalVoxels: 14,
    components: [
      {
        id: 'base_layer',
        name: 'Base Layer',
        description: 'The foundation base of the pyramid (3x3)',
        voxels: [],
        shapes: [
          {
            type: 'box',
            origin: [4, 0, 4],
            size: [3, 1, 3],
          },
        ],
        dependencies: [],
        assemblyOrder: 1,
      },
      {
        id: 'middle_layer',
        name: 'Middle Layer',
        description: 'The middle section of the pyramid (2x2)',
        voxels: [],
        shapes: [
          {
            type: 'box',
            origin: [4, 1, 4],
            size: [2, 1, 2],
          },
        ],
        dependencies: ['base_layer'],
        assemblyOrder: 2,
      },
      {
        id: 'apex',
        name: 'Apex',
        description: 'The top cap of the pyramid',
        voxels: [{ x: 5, y: 2, z: 5 }],
        dependencies: ['middle_layer'],
        assemblyOrder: 3,
      },
    ],
    buildStrategy: 'Bottom-up construction with each layer built before the next',
    estimatedTime: '~30 seconds',
  };

  try {
    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('Missing ANTHROPIC_API_KEY');
      return fallbackPlan;
    }

    const client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    console.log(`Generating assembly plan for: "${command}"`);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `${ASSEMBLY_SYSTEM_PROMPT}\n\nUser command: ${command}\n\nGenerate a detailed assembly plan with components.`,
        },
      ],
    });

    const fullText = (message.content ?? [])
      .map((chunk) => (chunk.type === 'text' ? chunk.text : ''))
      .join('')
      .trim();

    console.log('Claude response:', fullText);

    const cleaned = sanitizeJsonSnippet(fullText);
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      console.warn('No JSON found in response, using fallback');
      return fallbackPlan;
    }

    let plan: AssemblyPlan;
    try {
      plan = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as AssemblyPlan;
    } catch (parseErr) {
      console.error('Failed to parse assembly JSON:', parseErr, cleaned);
      return fallbackPlan;
    }

    // Validate and sanitize
    if (!plan.components || plan.components.length === 0) {
      console.warn('No components in plan, using fallback');
      return fallbackPlan;
    }

    // Sanitize all voxels
    plan.components = plan.components.map(component => {
      const sanitizedShapes = (component.shapes ?? []).map(sanitizeShapePrimitive);
      const shapeVoxels = sanitizedShapes.flatMap(expandShapePrimitive);
      const explicitVoxels = sanitizeVoxels(component.voxels ?? []);
      const mergedVoxels = dedupeVoxels([...explicitVoxels, ...shapeVoxels]);

      return {
        ...component,
        shapes: sanitizedShapes,
        voxels: mergedVoxels,
      };
    });

    // Calculate total voxels
    plan.totalVoxels = plan.components.reduce(
      (sum, component) => sum + component.voxels.length,
      0
    );

    console.log(`Generated plan with ${plan.components.length} components, ${plan.totalVoxels} total voxels`);
    
    return plan;
  } catch (e) {
    console.error('AI assembly plan error:', e);
    return fallbackPlan;
  }
}

function sanitizeJsonSnippet(text: string): string {
  return text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/\r\n/g, '\n')
    // remove trailing commas before closing braces/brackets
    .replace(/,\s*(?=[}\]])/g, '')
    .replace(/\u0000/g, ''); // strip null chars if any sneak in
}

/**
 * Export assembly plan to downloadable JSON file
 */
export function downloadAssemblyPlan(plan: AssemblyPlan, filename?: string): void {
  const jsonStr = JSON.stringify(plan, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `assembly_${plan.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert AssemblyPlan to flat voxel list for visualization
 */
export function assemblyPlanToVoxels(plan: AssemblyPlan): Voxel[] {
  const allVoxels: Voxel[] = [];
  plan.components.forEach(component => {
    allVoxels.push(...component.voxels);
  });
  return ensureGroundedVoxels(scaleVoxelsToPlayableGrid(allVoxels));
}

/**
 * Generate a human-readable assembly instruction text
 */
export function generateAssemblyInstructions(plan: AssemblyPlan): string {
  let instructions = `Assembly Instructions for ${plan.name}\n`;
  instructions += `${plan.description}\n\n`;
  instructions += `Strategy: ${plan.buildStrategy}\n`;
  instructions += `Estimated Time: ${plan.estimatedTime}\n`;
  instructions += `Total Voxels: ${plan.totalVoxels}\n\n`;
  instructions += `Components (${plan.components.length}):\n\n`;

  plan.components
    .sort((a, b) => a.assemblyOrder - b.assemblyOrder)
    .forEach(component => {
      instructions += `${component.assemblyOrder}. ${component.name} (${component.voxels.length} voxels)\n`;
      instructions += `   ${component.description}\n`;
      if (component.dependencies.length > 0) {
        instructions += `   Dependencies: ${component.dependencies.join(', ')}\n`;
      }
      instructions += `\n`;
    });

  return instructions;
}

function sanitizeVoxels(voxels: Voxel[]): Voxel[] {
  return voxels
    .filter(v => v && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number')
    .map(sanitizeVoxel);
}

function sanitizeVoxel(v: Voxel): Voxel {
  return {
    x: clampGridCoord(v.x),
    y: clampGridCoord(v.y),
    z: clampGridCoord(v.z),
  };
}

function clampGridCoord(n: number): number {
  return Math.max(0, Math.min(49, Math.round(n)));
}

function sanitizeShapePrimitive(shape: ShapePrimitive): ShapePrimitive {
  if (shape.type === 'box') {
    return {
      type: 'box',
      origin: [
        clampGridCoord(shape.origin[0]),
        clampGridCoord(shape.origin[1]),
        clampGridCoord(shape.origin[2]),
      ],
      size: [
        Math.max(1, Math.round(shape.size[0])),
        Math.max(1, Math.round(shape.size[1])),
        Math.max(1, Math.round(shape.size[2])),
      ],
      shell: Boolean(shape.shell),
      thickness: shape.thickness ? Math.max(1, Math.round(shape.thickness)) : undefined,
    };
  }
  return shape;
}

function expandShapePrimitive(shape: ShapePrimitive): Voxel[] {
  switch (shape.type) {
    case 'box':
      return expandBox(shape);
    default:
      return [];
  }
}

function expandBox(shape: Extract<ShapePrimitive, { type: 'box' }>): Voxel[] {
  const [ox, oy, oz] = shape.origin;
  const [w, h, d] = shape.size;
  const voxels: Voxel[] = [];
  const thickness = shape.shell ? (shape.thickness ?? 1) : null;

  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      for (let dz = 0; dz < d; dz++) {
        const voxel = sanitizeVoxel({ x: ox + dx, y: oy + dy, z: oz + dz });
        if (thickness) {
          const onBoundary =
            dx < thickness || dx >= w - thickness ||
            dy < thickness || dy >= h - thickness ||
            dz < thickness || dz >= d - thickness;
          if (!onBoundary) continue;
        }
        voxels.push(voxel);
      }
    }
  }
  return voxels;
}

function dedupeVoxels(voxels: Voxel[]): Voxel[] {
  const map = new Map<string, Voxel>();
  voxels.forEach(v => {
    const key = `${v.x},${v.y},${v.z}`;
    if (!map.has(key)) {
      map.set(key, v);
    }
  });
  return Array.from(map.values());
}

function scaleVoxelsToPlayableGrid(voxels: Voxel[]): Voxel[] {
  if (voxels.length === 0) return voxels;
  const targetMax = 9;

  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  };

  voxels.forEach(v => {
    bounds.minX = Math.min(bounds.minX, v.x);
    bounds.maxX = Math.max(bounds.maxX, v.x);
    bounds.minY = Math.min(bounds.minY, v.y);
    bounds.maxY = Math.max(bounds.maxY, v.y);
    bounds.minZ = Math.min(bounds.minZ, v.z);
    bounds.maxZ = Math.max(bounds.maxZ, v.z);
  });

  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const spanZ = Math.max(1, bounds.maxZ - bounds.minZ);

  return voxels.map(v => ({
    x: clampToGrid(((v.x - bounds.minX) / spanX) * targetMax),
    y: clampToGrid(((v.y - bounds.minY) / spanY) * targetMax),
    z: clampToGrid(((v.z - bounds.minZ) / spanZ) * targetMax),
  }));
}

function clampToGrid(value: number): number {
  const targetMax = 9;
  return Math.max(0, Math.min(targetMax, Math.round(value)));
}

function ensureGroundedVoxels(voxels: Voxel[]): Voxel[] {
  const set = new Set(voxels.map(v => `${v.x},${v.y},${v.z}`));
  const additions: Voxel[] = [];

  voxels.forEach(voxel => {
    for (let y = voxel.y - 1; y >= 0; y--) {
      const key = `${voxel.x},${y},${voxel.z}`;
      if (set.has(key)) break;
      const support = { x: voxel.x, y, z: voxel.z };
      set.add(key);
      additions.push(support);
    }
  });

  if (additions.length === 0) return voxels;
  return dedupeVoxels([...voxels, ...additions]);
}

