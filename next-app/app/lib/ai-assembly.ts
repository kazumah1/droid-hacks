// Enhanced AI assembly generation with component-based JSON output
import Anthropic from '@anthropic-ai/sdk';

export interface Voxel {
  x: number;
  y: number;
  z: number;
}

export interface Component {
  id: string;
  name: string;
  description: string;
  voxels: Voxel[];
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

The world is a 3D voxel grid with coordinates ranging from 0 to 9 (inclusive).
- x, y, z are integers (0-9)
- y=0 is the ground
- Structures must be gravity-stable (blocks need support below)

You must respond with ONLY a valid JSON object in this exact format:

{
  "name": "Structure Name",
  "description": "Brief description of what this structure is",
  "gridSize": {"x": 10, "y": 10, "z": 10},
  "totalVoxels": 0,
  "components": [
    {
      "id": "component_1",
      "name": "Component Name",
      "description": "What this component represents",
      "voxels": [
        {"x": 0, "y": 0, "z": 0},
        {"x": 1, "y": 0, "z": 0}
      ],
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
3. Use dependencies to ensure stable construction order
4. assemblyOrder starts at 1 and increments
5. Component IDs should be unique and descriptive (e.g., "foundation", "north_wall", "tower_base")
6. Total voxels should match the sum of all component voxels
7. All voxels must be within 0-9 range for x, y, z
8. Do NOT include any text outside the JSON object

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
    gridSize: { x: 10, y: 10, z: 10 },
    totalVoxels: 14,
    components: [
      {
        id: 'base_layer',
        name: 'Base Layer',
        description: 'The foundation base of the pyramid (3x3)',
        voxels: [
          { x: 4, y: 0, z: 4 }, { x: 5, y: 0, z: 4 }, { x: 6, y: 0, z: 4 },
          { x: 4, y: 0, z: 5 }, { x: 5, y: 0, z: 5 }, { x: 6, y: 0, z: 5 },
          { x: 4, y: 0, z: 6 }, { x: 5, y: 0, z: 6 }, { x: 6, y: 0, z: 6 },
        ],
        dependencies: [],
        assemblyOrder: 1,
      },
      {
        id: 'middle_layer',
        name: 'Middle Layer',
        description: 'The middle section of the pyramid (2x2)',
        voxels: [
          { x: 4, y: 1, z: 4 }, { x: 5, y: 1, z: 4 },
          { x: 4, y: 1, z: 5 }, { x: 5, y: 1, z: 5 },
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
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `${ASSEMBLY_SYSTEM_PROMPT}\n\nUser command: ${command}\n\nGenerate a detailed assembly plan with components.`,
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    console.log('Claude response:', text);

    // Extract JSON from response
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      console.warn('No JSON found in response, using fallback');
      return fallbackPlan;
    }

    const jsonStr = text.slice(jsonStart, jsonEnd + 1);
    const plan = JSON.parse(jsonStr) as AssemblyPlan;

    // Validate and sanitize
    if (!plan.components || plan.components.length === 0) {
      console.warn('No components in plan, using fallback');
      return fallbackPlan;
    }

    // Sanitize all voxels
    plan.components = plan.components.map(component => ({
      ...component,
      voxels: component.voxels
        .filter(v => v && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number')
        .map(v => ({
          x: Math.max(0, Math.min(9, Math.round(v.x))),
          y: Math.max(0, Math.min(9, Math.round(v.y))),
          z: Math.max(0, Math.min(9, Math.round(v.z))),
        })),
    }));

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
  return allVoxels;
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

