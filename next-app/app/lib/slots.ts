// Architect – slots.ts
// Person C: Convert ordered voxels to slots with dependencies

import * as THREE from 'three';
import { OrderedVoxel } from './stigmergy';

export type SlotState = 'locked' | 'available' | 'filled';

export interface Slot {
  id: number;
  position: THREE.Vector3;
  prereqIds: number[];
  state: SlotState;
  normal: THREE.Vector3;
  orientation: THREE.Quaternion;
}

/**
 * Converts ordered voxels into physical slots in 3D space.
 * Each slot has a position and tracks prerequisite slots (blocks below it).
 * 
 * @param ordered - Gravity-sorted voxels from stigmergy algorithm
 * @param cellSize - Physical size of each voxel cell (default 0.6 units)
 * @param gridCenter - Optional grid center for positioning. If not provided, calculated from voxels
 * @returns Array of slots with dependency information
 */
export function buildSlotsFromVoxels(
  ordered: OrderedVoxel[],
  cellSize = 0.6,
  fillDensity = 1,
  gridCenter?: number
): Slot[] {
  console.log(`[Slots] Building slots from ${ordered.length} ordered voxels`);
  
  // Calculate grid center from voxels if not provided
  let GRID_CENTER = gridCenter;
  if (GRID_CENTER === undefined && ordered.length > 0) {
    const xs = ordered.map(v => v.x);
    const zs = ordered.map(v => v.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    GRID_CENTER = (minX + maxX) / 2;
    // Use same center for Z, or calculate separately if needed
    const centerZ = (minZ + maxZ) / 2;
    // For simplicity, use X center for both (or average if they differ significantly)
    if (Math.abs(GRID_CENTER - centerZ) > 0.1) {
      GRID_CENTER = (GRID_CENTER + centerZ) / 2;
    }
  } else if (GRID_CENTER === undefined) {
    // Default fallback
    GRID_CENTER = 24.5; // center of 0-49 grid
  }
  
  const slots: Slot[] = [];
  const keyToId = new Map<string, number>();
  const key = (v: { x: number; y: number; z: number }) => `${v.x},${v.y},${v.z}`;
  
  // Identity quaternion and upward normal for all cubes (axis-aligned, no rotation)
  const identityOrientation = new THREE.Quaternion();
  const upwardNormal = new THREE.Vector3(0, 1, 0);

  // Create slots from ordered voxels (preserving order from stigmergy)
  // IMPORTANT: The order here MUST match the order from stigmergy algorithm
  // Slot ID = index in ordered array = order of placement
  ordered.forEach((v, idx) => {
    // Simple, direct position calculation - center the cube on the voxel grid position
    const pos = new THREE.Vector3(
      (v.x - GRID_CENTER) * cellSize,
      0.3 + v.y * cellSize,
      (v.z - GRID_CENTER) * cellSize
    );

    const slot: Slot = {
      id: idx, // Slot ID matches index in ordered array
      position: pos,
      prereqIds: [],
      state: 'locked',
      normal: upwardNormal.clone(),
      orientation: identityOrientation.clone(),
    };

    slots.push(slot);
    keyToId.set(key(v), idx);
  });

  // Add prerequisite dependencies based on gravity and lateral support
  // CRITICAL: Each slot at y>0 MUST have support (either below or adjacent)
  slots.forEach((slot, idx) => {
    const v = ordered[idx];
    if (v.y > 0) {
      const belowKey = `${v.x},${v.y - 1},${v.z}`;
      const belowId = keyToId.get(belowKey);
      
      if (belowId !== undefined) {
        // Verify that the prerequisite slot comes BEFORE this slot in the order
        if (belowId >= idx) {
          console.error(`[Slots] CRITICAL: Slot ${idx} at y=${v.y} has prerequisite ${belowId} at y=${ordered[belowId].y} that comes AFTER it in order!`);
        }
        slot.prereqIds.push(belowId);
      } else {
        // No vertical support - check lateral support (bridges/cantilevers)
        // We look for neighbors that are placed BEFORE this one
        const neighbors = [
          { x: v.x - 1, y: v.y, z: v.z },
          { x: v.x + 1, y: v.y, z: v.z },
          { x: v.x, y: v.y, z: v.z - 1 },
          { x: v.x, y: v.y, z: v.z + 1 },
        ];

        let foundSupport = false;
        for (const n of neighbors) {
          const nKey = `${n.x},${n.y},${n.z}`;
          const nId = keyToId.get(nKey);
          // Must exist and be placed earlier
          if (nId !== undefined && nId < idx) {
            slot.prereqIds.push(nId);
            foundSupport = true;
          }
        }

        if (!foundSupport) {
          console.warn(`[Slots] Floating block at (${v.x},${v.y},${v.z}) has no support below or laterally from earlier blocks.`);
          // We don't lock it here because updateAvailableSlots will treat empty prereqs as available
          // But since gravitySortVoxels guarantees we only emit valid blocks, this shouldn't happen often
        }
      }
    }
  });

  // Initialize: base layer and any slot with satisfied prereqs become available
  updateAvailableSlots(slots);

  const availableCount = slots.filter(s => s.state === 'available').length;
  console.log(`[Slots] Created ${slots.length} slots (${availableCount} initially available)`);
  
  return slots;
}

/**
 * Updates slot availability based on prerequisite fulfillment.
 * A locked slot becomes available when all its prerequisites are filled.
 * This implements the stigmergic signaling: filling a slot signals to dependent slots.
 * 
 * @param slots - Array of slots to update
 */
export function updateAvailableSlots(slots: Slot[]) {
  for (const slot of slots) {
    if (slot.state !== 'locked') continue;
    
    if (slot.prereqIds.length === 0) {
      // No prerequisites - could be ground level OR missing prerequisite
      // Only make available if it's actually ground level (y=0)
      // We can't check y here, so we'll trust that slots with no prereqs are ground level
      slot.state = 'available';
      continue;
    }
    
    // Check that all prerequisites are filled
    const ready = slot.prereqIds.every(id => {
      if (id < 0 || id >= slots.length) {
        console.error(`[Slots] Invalid prerequisite ID ${id} for slot ${slot.id}`);
        return false;
      }
      return slots[id].state === 'filled';
    });
    
    if (ready) {
      slot.state = 'available';
    }
  }
}

