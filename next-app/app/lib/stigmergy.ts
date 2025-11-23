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
  console.log(`[Stigmergy] Input voxels: ${voxels.length}`);
  
  const remaining = new Map<string, Voxel>();
  const key = (v: Voxel) => `${v.x},${v.y},${v.z}`;

  voxels.forEach(v => remaining.set(key(v), v));
  console.log(`[Stigmergy] Unique voxels after key mapping: ${remaining.size}`);

  // Keep track of all original voxels to check if support blocks exist
  const allVoxelKeys = new Set(remaining.keys());

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
      
      // Check support below (standard gravity)
      const belowKey = `${v.x},${v.y - 1},${v.z}`;
      if (placed.has(belowKey)) {
        frontier.push([k, v]);
        continue;
      }

      // Check lateral support (cantilevers/bridges)
      // If a neighbor at the same height is already placed, we can attach to it
      const neighbors = [
        { x: v.x - 1, y: v.y, z: v.z },
        { x: v.x + 1, y: v.y, z: v.z },
        { x: v.x, y: v.y, z: v.z - 1 },
        { x: v.x, y: v.y, z: v.z + 1 },
      ];

      let hasLateralSupport = false;
      for (const n of neighbors) {
        const nKey = `${n.x},${n.y},${n.z}`;
        if (placed.has(nKey)) {
          hasLateralSupport = true;
          break;
        }
      }

      if (hasLateralSupport) {
        frontier.push([k, v]);
      }
    }

    if (frontier.length === 0) {
      // Disconnected structure detected (floating blocks with no support yet)
      // This might happen if the only support is lateral but hasn't been processed yet
      // OR if it's a truly floating block
      
      // We'll try to find ANY block that has a valid support (below or lateral) that exists in the INPUT
      // but hasn't been placed yet.
      
      let foundValid = false;
      
      // Check if we can find any block that has support in the original set, even if not placed yet
      // This helps identify if we have a valid structure that's just being processed in wrong order
      // But actually, the loop above checks against 'placed', so if we found nothing above,
      // it means no remaining block has a placed neighbor/support.
      
      // If we are here, it means all remaining blocks are:
      // 1. Floating (no support in input)
      // 2. Supported only by other remaining blocks (islands)
      
      // We can't place them.
      console.warn(`[Stigmergy] No placeable blocks found in frontier. Remaining: ${remaining.size}`);
      
      // Debug: Check why they are not placeable
      let floatingCount = 0;
      const toRemove: string[] = [];
      
      for (const [k, v] of remaining.entries()) {
        const belowKey = `${v.x},${v.y - 1},${v.z}`;
        const hasBelow = allVoxelKeys.has(belowKey);
        
        const neighbors = [
          { x: v.x - 1, y: v.y, z: v.z },
          { x: v.x + 1, y: v.y, z: v.z },
          { x: v.x, y: v.y, z: v.z - 1 },
          { x: v.x, y: v.y, z: v.z + 1 },
        ];
        const hasLateral = neighbors.some(n => allVoxelKeys.has(`${n.x},${n.y},${n.z}`));
        
        if (!hasBelow && !hasLateral && v.y > 0) {
          // Truly floating
          toRemove.push(k);
          floatingCount++;
        }
      }
      
      if (toRemove.length > 0) {
        console.warn(`[Stigmergy] Removing ${toRemove.length} truly floating blocks`);
        toRemove.forEach(k => remaining.delete(k));
        // Continue loop to see if removing them helps (unlikely to help place others, but cleans up)
        if (remaining.size > 0 && toRemove.length < remaining.size) {
            continue;
        } else {
            break;
        }
      } else {
         // We have islands. We can't build them starting from ground.
         // Unless we missed some ground blocks?
         // Double check ground blocks
         const hasGround = Array.from(remaining.values()).some(v => v.y === 0);
         if (hasGround) {
             // Should have been picked up by loop above.
             console.error("[Stigmergy] Logic error: Ground blocks remaining but not picked up.");
         }
         
         console.warn("[Stigmergy] Remaining blocks form disconnected islands. Cannot build.");
         break;
      }
    }

    // Sort frontier by y-level to ensure lower blocks are always placed first
    // This prevents race conditions where higher blocks might be processed before lower ones
    frontier.sort((a, b) => {
      // Primary sort: by y-level (lower first)
      if (a[1].y !== b[1].y) {
        return a[1].y - b[1].y;
      }
      // Secondary sort: by x, then z for deterministic ordering
      if (a[1].x !== b[1].x) {
        return a[1].x - b[1].x;
      }
      return a[1].z - b[1].z;
    });

    for (const [k, v] of frontier) {
      remaining.delete(k);
      const ov: OrderedVoxel = { ...v, index: idx++ };
      placed.set(k, ov);
      order.push(ov);
    }
  }

  console.log(`[Stigmergy] Output ordered voxels: ${order.length}`);
  return order;
}

