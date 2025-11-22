// Architect – stigmergy.ts
// Person C: Stigmergy and space filling algorithm

export interface Voxel {
  x: number;
  y: number;
  z: number;
}

export interface OrderedVoxel extends Voxel {
  index: number;
}

/**
 * Gravity / frontier sort:
 * - y=0 can be placed anytime (grounded).
 * - A voxel at (x,y,z) with y>0 can only be placed after a voxel exists at (x,y-1,z).
 * 
 * This implements a stigmergic approach where the environment (placement of lower blocks)
 * determines what upper blocks can be placed next.
 */
export function gravitySortVoxels(voxels: Voxel[]): OrderedVoxel[] {
  const remaining = new Map<string, Voxel>();
  const key = (v: Voxel) => `${v.x},${v.y},${v.z}`;

  voxels.forEach(v => remaining.set(key(v), v));

  const placed = new Map<string, OrderedVoxel>();
  const order: OrderedVoxel[] = [];

  let idx = 0;
  while (remaining.size > 0) {
    const frontier: [string, Voxel][] = [];

    for (const [k, v] of remaining.entries()) {
      if (v.y === 0) {
        // Ground level - always placeable
        frontier.push([k, v]);
        continue;
      }
      const belowKey = `${v.x},${v.y - 1},${v.z}`;
      if (placed.has(belowKey)) {
        // Support exists below - can be placed
        frontier.push([k, v]);
      }
    }

    if (frontier.length === 0) {
      // Disconnected structure detected (floating blocks with no support)
      // Process one layer at a time (lowest remaining blocks first) for more plausible builds
      console.warn('Disconnected structure detected. Processing lowest remaining layer.');
      const lowestRemaining = Math.min(...Array.from(remaining.values()).map(v => v.y));
      
      for (const [k, v] of remaining.entries()) {
        if (v.y === lowestRemaining) {
          frontier.push([k, v]);
        }
      }
      
      // Safety check: if we still have no frontier, something is wrong
      if (frontier.length === 0) {
        console.error('Critical error: Unable to process remaining voxels. Breaking loop.');
        break;
      }
    }

    for (const [k, v] of frontier) {
      remaining.delete(k);
      const ov: OrderedVoxel = { ...v, index: idx++ };
      placed.set(k, ov);
      order.push(ov);
    }
  }

  return order;
}

