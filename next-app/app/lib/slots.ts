// Architect – slots.ts
// Person C: Convert ordered voxels to slots with dependencies

import * as THREE from 'three';
import { OrderedVoxel } from './stigmergy';

export type SlotState = 'locked' | 'available' | 'filled';

export interface Slot {
  id: number;
  position: THREE.Vector3;
  prereqIds: number[];
  supportIds: number[];
  faceNeighborIds: number[];
  state: SlotState;
  normal: THREE.Vector3;
  orientation: THREE.Quaternion;
  level: number;
}

/**
 * Converts ordered voxels into physical slots in 3D space.
 * Each slot has a position and tracks prerequisite slots (blocks below it).
 * 
 * @param ordered - Gravity-sorted voxels from stigmergy algorithm
 * @param cellSize - Physical size of each voxel cell (default 0.6 units)
 * @returns Array of slots with dependency information
 */
const GRID_CENTER = 24.5; // center of 0-49 grid

export function buildSlotsFromVoxels(ordered: OrderedVoxel[], cellSize = 0.6): Slot[] {
  console.log(`[Slots] Building slots from ${ordered.length} ordered voxels`);
  
  const slots: Slot[] = [];
  const keyToSlotIds = new Map<string, number[]>();
  const slotVoxels: OrderedVoxel[] = [];
  const key = (v: { x: number; y: number; z: number }) => `${v.x},${v.y},${v.z}`;
  
  // Identity quaternion and upward normal for all cubes (axis-aligned, no rotation)
  const identityOrientation = new THREE.Quaternion();
  const upwardNormal = new THREE.Vector3(0, 1, 0);

  ordered.forEach((voxel) => {
    const ids: number[] = [];
    
    // Simple, direct position calculation - center the cube on the voxel grid position
    const pos = new THREE.Vector3(
      (voxel.x - GRID_CENTER) * cellSize,
      0.3 + voxel.y * cellSize,
      (voxel.z - GRID_CENTER) * cellSize
    );

    const slot: Slot = {
      id: slots.length,
      position: pos,
      prereqIds: [],
      supportIds: [],
      faceNeighborIds: [],
      state: 'locked',
      normal: upwardNormal.clone(),
      orientation: identityOrientation.clone(),
      level: voxel.y ?? 0,
    };

    slots.push(slot);
    ids.push(slot.id);
    slotVoxels.push(voxel);

    keyToSlotIds.set(key(voxel), ids);
  });

  // Add prerequisite dependencies based on gravity
  slots.forEach((slot, idx) => {
    const voxel = slotVoxels[idx];
    if (voxel.y > 0) {
      const belowKey = `${voxel.x},${voxel.y - 1},${voxel.z}`;
      const belowIds = keyToSlotIds.get(belowKey);
      if (belowIds?.length) {
        slot.prereqIds.push(...belowIds);
      }
    }
  });

  // Populate support + face neighbor dependencies
  slots.forEach((slot, idx) => {
    const voxel = slotVoxels[idx];
    const addIds = (pos: { x: number; y: number; z: number }, target: number[]) => {
      const ids = keyToSlotIds.get(key(pos));
      if (ids?.length) target.push(...ids);
    };

    if (voxel.y > 0) {
      addIds({ x: voxel.x, y: voxel.y - 1, z: voxel.z }, slot.supportIds);
    }

    // face neighbors (±x, ±z, and below)
    [
      { x: voxel.x + 1, y: voxel.y, z: voxel.z },
      { x: voxel.x - 1, y: voxel.y, z: voxel.z },
      { x: voxel.x, y: voxel.y, z: voxel.z + 1 },
      { x: voxel.x, y: voxel.y, z: voxel.z - 1 },
      { x: voxel.x, y: voxel.y - 1, z: voxel.z },
    ].forEach((pos) => addIds(pos, slot.faceNeighborIds));
  });

  // Initialize availability
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
    
    const hasGround = slot.level === 0;

    const verticalReady =
      slot.supportIds.length === 0 || slot.supportIds.every(id => slots[id].state === 'filled');
    if (!hasGround && !verticalReady) continue;

    const faceReady =
      hasGround ||
      (slot.faceNeighborIds.length === 0
        ? verticalReady
        : slot.faceNeighborIds.some(id => slots[id].state === 'filled'));

    if (faceReady) {
      slot.state = 'available';
    }
  }
}

