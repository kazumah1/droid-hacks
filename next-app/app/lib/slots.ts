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
}

/**
 * Converts ordered voxels into physical slots in 3D space.
 * Each slot has a position and tracks prerequisite slots (blocks below it).
 * 
 * @param ordered - Gravity-sorted voxels from stigmergy algorithm
 * @param cellSize - Physical size of each voxel cell (default 0.6 units)
 * @returns Array of slots with dependency information
 */
export function buildSlotsFromVoxels(ordered: OrderedVoxel[], cellSize = 0.6): Slot[] {
  const slots: Slot[] = [];
  const keyToId = new Map<string, number>();
  const key = (v: { x: number; y: number; z: number }) => `${v.x},${v.y},${v.z}`;

  // Create slots from ordered voxels
  ordered.forEach((v, idx) => {
    const pos = new THREE.Vector3(
      (v.x - 5) * cellSize,         // center around origin (10x10 grid -> -3 to +3 units)
      0.3 + v.y * cellSize,         // offset from ground by 0.3, stack upward
      (v.z - 5) * cellSize,
    );

    const slot: Slot = {
      id: idx,
      position: pos,
      prereqIds: [],
      state: 'locked',
    };
    slots.push(slot);
    keyToId.set(key(v), idx);
  });

  // Add prerequisite dependencies based on gravity
  slots.forEach((slot, idx) => {
    const v = ordered[idx];
    if (v.y > 0) {
      const belowKey = `${v.x},${v.y - 1},${v.z}`;
      const belowId = keyToId.get(belowKey);
      if (belowId !== undefined) {
        slot.prereqIds.push(belowId);
      }
    }
  });

  // Initialize: base layer and any slot with satisfied prereqs become available
  updateAvailableSlots(slots);

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
      // No prerequisites - ground level, immediately available
      slot.state = 'available';
      continue;
    }
    
    const ready = slot.prereqIds.every(id => slots[id].state === 'filled');
    if (ready) {
      slot.state = 'available';
    }
  }
}

