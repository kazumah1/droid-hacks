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
 * @returns Array of slots with dependency information
 */
const GRID_CENTER = 4.5; // center of 0-9 grid

export function buildSlotsFromVoxels(
  ordered: OrderedVoxel[],
  cellSize = 0.6,
  fillDensity = 1
): Slot[] {
  const slots: Slot[] = [];
  const keyToSlotIds = new Map<string, number[]>();
  const voxelNormals = new Map<string, THREE.Vector3>();
  const slotVoxels: OrderedVoxel[] = [];
  const subdivisions = Math.max(1, Math.round(fillDensity));
  const step = cellSize / subdivisions;
  const startOffset = -cellSize / 2 + step / 2;
  const key = (v: { x: number; y: number; z: number }) => `${v.x},${v.y},${v.z}`;
  const filled = new Set<string>(ordered.map((v) => key(v)));

  const faceDirections = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 1, 0),
  ];

  ordered.forEach((voxel) => {
    const normal = new THREE.Vector3();
    faceDirections.forEach((dir) => {
      const neighborKey = key({
        x: voxel.x + dir.x,
        y: voxel.y + dir.y,
        z: voxel.z + dir.z,
      });
      if (!filled.has(neighborKey)) {
        normal.add(dir);
      }
    });
    if (normal.lengthSq() === 0) {
      normal.set(0, 1, 0);
    } else {
      normal.normalize();
    }
    voxelNormals.set(key(voxel), normal);
  });

  ordered.forEach((voxel) => {
    const ids: number[] = [];
    const voxelKey = key(voxel);
    const voxelNormal = voxelNormals.get(voxelKey) ?? new THREE.Vector3(0, 1, 0);
    const orientation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      voxelNormal
    );

    for (let dx = 0; dx < subdivisions; dx++) {
      for (let dz = 0; dz < subdivisions; dz++) {
        const pos = new THREE.Vector3(
          (voxel.x - GRID_CENTER) * cellSize + startOffset + dx * step,
          0.3 + voxel.y * cellSize,
          (voxel.z - GRID_CENTER) * cellSize + startOffset + dz * step
        );

        const slot: Slot = {
          id: slots.length,
          position: pos,
          prereqIds: [],
          state: 'locked',
          normal: voxelNormal.clone(),
          orientation: orientation.clone(),
        };

        slots.push(slot);
        ids.push(slot.id);
        slotVoxels.push(voxel);
      }
    }

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

