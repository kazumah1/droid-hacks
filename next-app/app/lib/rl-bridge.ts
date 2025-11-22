// Bridge between LLM voxel output and RL grid targets
// Converts 3D voxel structures to 2D grid patterns for RL agents

import { Voxel } from './stigmergy';

export interface RLTarget {
  grid: number[][][];  // 3D grid now!
  metadata: {
    originalVoxelCount: number;
    gridSize: number;
    scalingApplied: boolean;
  };
}

/**
 * Convert LLM-generated 3D voxels to RL 3D grid target
 * Direct 3D-to-3D mapping (no projection needed!)
 */
export function voxelsToRLTarget(
  voxels: Voxel[],
  gridSize: number = 8
): RLTarget {
  const grid: number[][][] = Array(gridSize)
    .fill(0)
    .map(() => Array(gridSize).fill(0).map(() => Array(gridSize).fill(0)));

  // Find voxel bounds for scaling
  if (voxels.length === 0) {
    return {
      grid,
      metadata: {
        originalVoxelCount: 0,
        gridSize,
        scalingApplied: false,
      },
    };
  }

  const xValues = voxels.map(v => v.x);
  const yValues = voxels.map(v => v.y);
  const zValues = voxels.map(v => v.z);
  
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const rangeZ = maxZ - minZ || 1;

  // Scale voxels to fit in 8×8×8 grid
  for (const voxel of voxels) {
    const x = Math.floor(((voxel.x - minX) / rangeX) * (gridSize - 1));
    const y = Math.floor(((voxel.y - minY) / rangeY) * (gridSize - 1));
    const z = Math.floor(((voxel.z - minZ) / rangeZ) * (gridSize - 1));
    
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize && z >= 0 && z < gridSize) {
      grid[x][y][z] = 1.0;
    }
  }

  return {
    grid,
    metadata: {
      originalVoxelCount: voxels.length,
      gridSize,
      scalingApplied: rangeX > gridSize || rangeY > gridSize || rangeZ > gridSize,
    },
  };
}

/**
 * Visualize 3D target grid as ASCII (layer by layer)
 */
export function visualizeTarget(grid: number[][][]): string {
  let output = '\n';
  for (let y = 0; y < grid[0].length; y++) {
    if (grid.some(layer => layer[y].some(cell => cell > 0))) {
      output += `Layer Y=${y}:\n`;
      for (let x = 0; x < grid.length; x++) {
        output += grid[x][y].map(val => (val > 0 ? '🟦' : '⬜')).join('') + '\n';
      }
      output += '\n';
    }
  }
  return output;
}

/**
 * Calculate target complexity (for adaptive rewards) - 3D version
 */
export function calculateComplexity(grid: number[][][]): {
  blockCount: number;
  density: number;
  maxHeight: number;
  volume: number;
} {
  const gridSize = grid.length;
  let blockCount = 0;
  let maxHeight = 0;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      for (let k = 0; k < gridSize; k++) {
        if (grid[i][j][k] > 0) {
          blockCount++;
          maxHeight = Math.max(maxHeight, j);
        }
      }
    }
  }

  const volume = gridSize * gridSize * gridSize;
  const density = blockCount / volume;

  return { blockCount, density, maxHeight, volume };
}

/**
 * Example usage with your existing LLM pipeline:
 * 
 * ```typescript
 * import { generateShapeFromText } from './ai_shapes';
 * import { voxelsToRLTarget } from './rl-bridge';
 * import { RLSwarmController } from './rl-agent';
 * 
 * // User input
 * const voxels = await generateShapeFromText("pyramid 4");
 * 
 * // Convert to RL 3D target (direct mapping!)
 * const { grid } = voxelsToRLTarget(voxels, 8);
 * 
 * // Send to RL agents (they'll build it in 3D!)
 * rlSwarm.target = grid;
 * await rlSwarm.update(dt);
 * ```
 */

