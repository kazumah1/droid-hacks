// Unit tests for slots.ts (without full Three.js setup)
// Run with: npx tsx app/lib/__tests__/slots.test.ts

import { buildSlotsFromVoxels, updateAvailableSlots, Slot } from '../slots';
import { OrderedVoxel } from '../stigmergy';

// Mock THREE.Vector3 for testing without Three.js
class MockVector3 {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}
  
  set(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  
  clone() {
    return new MockVector3(this.x, this.y, this.z);
  }
  
  copy(v: MockVector3) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  
  distanceTo(v: MockVector3) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

// Inject mock into global scope for tests
(global as any).THREE = {
  Vector3: MockVector3,
};

// Simple test framework
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   ${error}`);
    failed++;
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Expected condition to be true');
  }
}

// ========== TESTS ==========

test('Empty voxels produce empty slots', () => {
  const slots = buildSlotsFromVoxels([]);
  assertEqual(slots.length, 0);
});

test('Single ground voxel creates available slot', () => {
  const voxels: OrderedVoxel[] = [{ x: 5, y: 0, z: 5, index: 0 }];
  const slots = buildSlotsFromVoxels(voxels);
  
  assertEqual(slots.length, 1);
  assertEqual(slots[0].id, 0);
  assertEqual(slots[0].state, 'available');
  assertEqual(slots[0].prereqIds.length, 0);
});

test('Ground voxels have no prerequisites', () => {
  const voxels: OrderedVoxel[] = [
    { x: 0, y: 0, z: 0, index: 0 },
    { x: 1, y: 0, z: 0, index: 1 },
    { x: 2, y: 0, z: 0, index: 2 },
  ];
  const slots = buildSlotsFromVoxels(voxels);
  
  assertEqual(slots.length, 3);
  slots.forEach(slot => {
    assertEqual(slot.prereqIds.length, 0, 'Ground slots should have no prereqs');
    assertEqual(slot.state, 'available', 'Ground slots should be available');
  });
});

test('Upper voxel depends on voxel below', () => {
  const voxels: OrderedVoxel[] = [
    { x: 5, y: 0, z: 5, index: 0 }, // Ground
    { x: 5, y: 1, z: 5, index: 1 }, // Above ground
  ];
  const slots = buildSlotsFromVoxels(voxels);
  
  assertEqual(slots.length, 2);
  
  const ground = slots[0];
  const upper = slots[1];
  
  assertEqual(ground.prereqIds, []);
  assertEqual(ground.state, 'available');
  
  assertEqual(upper.prereqIds, [0]); // Depends on slot 0
  assertEqual(upper.state, 'locked'); // Not available yet
});

test('Slot positions are correctly calculated', () => {
  const voxels: OrderedVoxel[] = [
    { x: 5, y: 0, z: 5, index: 0 }, // Center of 10x10 grid
  ];
  const cellSize = 0.6;
  const slots = buildSlotsFromVoxels(voxels, cellSize);
  
  const pos = slots[0].position as any;
  
  // (5-5)*0.6 = 0, 0.3 + 0*0.6 = 0.3, (5-5)*0.6 = 0
  assertEqual(pos.x, 0);
  assertEqual(pos.y, 0.3);
  assertEqual(pos.z, 0);
});

test('updateAvailableSlots unlocks dependent slots', () => {
  const voxels: OrderedVoxel[] = [
    { x: 5, y: 0, z: 5, index: 0 },
    { x: 5, y: 1, z: 5, index: 1 },
  ];
  const slots = buildSlotsFromVoxels(voxels);
  
  // Initial state: ground available, upper locked
  assertEqual(slots[0].state, 'available');
  assertEqual(slots[1].state, 'locked');
  
  // Simulate filling the ground slot
  slots[0].state = 'filled';
  updateAvailableSlots(slots);
  
  // Now upper slot should be available
  assertEqual(slots[1].state, 'available');
});

test('Multiple prerequisites must all be filled', () => {
  // Create an L-shape that requires two supports
  // This is a bit contrived since our system only checks directly below,
  // but let's test the prereq logic anyway
  const voxels: OrderedVoxel[] = [
    { x: 5, y: 0, z: 5, index: 0 },
    { x: 5, y: 1, z: 5, index: 1 },
  ];
  const slots = buildSlotsFromVoxels(voxels);
  
  // Manually add extra prereq for testing
  slots[1].prereqIds.push(0, 0); // Duplicate to test "all must be filled"
  slots[1].state = 'locked';
  
  // Fill the prerequisite
  slots[0].state = 'filled';
  updateAvailableSlots(slots);
  
  // Should unlock
  assertEqual(slots[1].state, 'available');
});

test('Pyramid structure has correct dependencies', () => {
  const voxels: OrderedVoxel[] = [
    // Base layer (2x2)
    { x: 0, y: 0, z: 0, index: 0 },
    { x: 1, y: 0, z: 0, index: 1 },
    { x: 0, y: 0, z: 1, index: 2 },
    { x: 1, y: 0, z: 1, index: 3 },
    // Top (1 block)
    { x: 0, y: 1, z: 0, index: 4 },
  ];
  const slots = buildSlotsFromVoxels(voxels);
  
  assertEqual(slots.length, 5);
  
  // Base layer: all available
  assertEqual(slots[0].state, 'available');
  assertEqual(slots[1].state, 'available');
  assertEqual(slots[2].state, 'available');
  assertEqual(slots[3].state, 'available');
  
  // Top: locked, depends on slot 0 (the block directly below at 0,0,0)
  assertEqual(slots[4].state, 'locked');
  assertEqual(slots[4].prereqIds, [0]);
});

test('Filling slots progressively unlocks structure', () => {
  const voxels: OrderedVoxel[] = [
    { x: 5, y: 0, z: 5, index: 0 },
    { x: 5, y: 1, z: 5, index: 1 },
    { x: 5, y: 2, z: 5, index: 2 },
  ];
  const slots = buildSlotsFromVoxels(voxels);
  
  // Initial: only ground available
  assertEqual(slots[0].state, 'available');
  assertEqual(slots[1].state, 'locked');
  assertEqual(slots[2].state, 'locked');
  
  // Fill ground
  slots[0].state = 'filled';
  updateAvailableSlots(slots);
  
  // Middle unlocks
  assertEqual(slots[1].state, 'available');
  assertEqual(slots[2].state, 'locked');
  
  // Fill middle
  slots[1].state = 'filled';
  updateAvailableSlots(slots);
  
  // Top unlocks
  assertEqual(slots[2].state, 'available');
});

test('Disconnected structures handled independently', () => {
  const voxels: OrderedVoxel[] = [
    // Tower 1
    { x: 0, y: 0, z: 0, index: 0 },
    { x: 0, y: 1, z: 0, index: 1 },
    // Tower 2 (separate)
    { x: 9, y: 0, z: 9, index: 2 },
    { x: 9, y: 1, z: 9, index: 3 },
  ];
  const slots = buildSlotsFromVoxels(voxels);
  
  // Both ground slots available
  assertEqual(slots[0].state, 'available');
  assertEqual(slots[2].state, 'available');
  
  // Both upper slots locked
  assertEqual(slots[1].state, 'locked');
  assertEqual(slots[3].state, 'locked');
  
  // Fill tower 1 ground only
  slots[0].state = 'filled';
  updateAvailableSlots(slots);
  
  // Only tower 1 upper unlocks
  assertEqual(slots[1].state, 'available');
  assertEqual(slots[3].state, 'locked');
});

test('Custom cell size affects positions', () => {
  const voxels: OrderedVoxel[] = [
    { x: 5, y: 1, z: 5, index: 0 },
  ];
  
  const slots1 = buildSlotsFromVoxels(voxels, 0.6);
  const slots2 = buildSlotsFromVoxels(voxels, 1.2);
  
  const pos1 = slots1[0].position as any;
  const pos2 = slots2[0].position as any;
  
  // Y position should scale with cell size
  assertTrue(pos2.y > pos1.y, 'Larger cell size should give higher Y position');
  assertEqual(pos2.y, 0.3 + 1 * 1.2); // 0.3 + y * cellSize
});

// Run all tests
console.log('\n🧪 Running Slots Tests...\n');
console.log('='.repeat(50));

console.log('='.repeat(50));
console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${passed + failed}\n`);

if (failed > 0) {
  process.exit(1);
}

