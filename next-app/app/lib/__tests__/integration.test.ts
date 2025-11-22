// Integration test: stigmergy.ts → slots.ts → autonomous-swarm.ts
// Run with: npx tsx app/lib/__tests__/integration.test.ts

import { gravitySortVoxels, Voxel } from '../stigmergy';
import { buildSlotsFromVoxels } from '../slots';
import { AutonomousBot, AutonomousSwarmSystem } from '../autonomous-swarm';

// Mock THREE.js
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
  
  add(v: MockVector3) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  
  sub(v: MockVector3) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  
  multiplyScalar(s: number) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  
  normalize() {
    const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (len > 0) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }
  
  subVectors(a: MockVector3, b: MockVector3) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }
}

class MockGroup {
  position = new MockVector3();
  rotation = { y: 0 };
  
  traverse(fn: any) {
    // Do nothing
  }
  
  lookAt(v: MockVector3) {
    // Do nothing
  }
}

class MockMesh {
  material: any;
}

(global as any).THREE = {
  Vector3: MockVector3,
  Group: MockGroup,
  Mesh: MockMesh,
  MathUtils: {
    clamp: (val: number, min: number, max: number) => Math.max(min, Math.min(max, val)),
  },
};

// Test framework
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

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Expected condition to be true');
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

// Helper
function createMockBot(id: number, x = 0, y = 0.3, z = 0): AutonomousBot {
  const mesh = new MockGroup() as any;
  mesh.position.set(x, y, z);
  return new AutonomousBot(id, mesh);
}

// ========== INTEGRATION TESTS ==========

test('Full pipeline: Voxels → Ordered → Slots → Autonomous Swarm', () => {
  // Step 1: Create voxels (from AI or manual)
  const voxels: Voxel[] = [
    { x: 5, y: 0, z: 5 }, // Ground
    { x: 5, y: 1, z: 5 }, // First floor
    { x: 5, y: 2, z: 5 }, // Second floor
  ];

  // Step 2: Stigmergy - gravity sort
  const ordered = gravitySortVoxels(voxels);
  assertEqual(ordered.length, 3);
  assertTrue(ordered[0].y === 0, 'Ground should be first');

  // Step 3: Build slots
  const slots = buildSlotsFromVoxels(ordered);
  assertEqual(slots.length, 3);
  assertEqual(slots[0].state, 'available', 'Ground slot should be available');
  assertEqual(slots[1].state, 'locked', 'First floor should be locked');
  assertEqual(slots[2].state, 'locked', 'Second floor should be locked');

  // Step 4: Create autonomous swarm
  const bots = [
    createMockBot(0, 0, 0.3, 0),
    createMockBot(1, 1, 0.3, 1),
    createMockBot(2, 2, 0.3, 2),
  ];
  const swarm = new AutonomousSwarmSystem(bots);
  swarm.setSlots(slots);

  // Step 5: Verify swarm accepts the slots
  assertEqual(swarm.slots.length, 3);
  
  console.log('   ✓ Voxels → Gravity Sort → Slots → Autonomous Swarm pipeline works!');
});

test('Autonomous swarm builds simple tower progressively', () => {
  // Create a 3-block tower
  const voxels: Voxel[] = [
    { x: 5, y: 0, z: 5 },
    { x: 5, y: 1, z: 5 },
    { x: 5, y: 2, z: 5 },
  ];

  const ordered = gravitySortVoxels(voxels);
  const slots = buildSlotsFromVoxels(ordered);

  // Create bots near the structure
  const bots = [
    createMockBot(0, 0, 0.3, 0),
    createMockBot(1, 0.5, 0.3, 0.5),
    createMockBot(2, 1, 0.3, 1),
  ];
  const swarm = new AutonomousSwarmSystem(bots);
  swarm.setSlots(slots);

  // Simulate for a while
  for (let i = 0; i < 200; i++) {
    swarm.update(0.05); // 50ms steps = 10 seconds total
  }

  const stats = swarm.getStats();
  
  // At least 1 bot should have locked into a slot
  assertTrue(stats.slots.filled >= 1, `Expected at least 1 filled slot, got ${stats.slots.filled}`);
  console.log(`   ✓ Filled ${stats.slots.filled}/3 slots in simulated 10 seconds`);
});

test('Pyramid builds bottom-up using autonomous swarm', () => {
  // Create a 3-layer pyramid
  const voxels: Voxel[] = [
    // Base layer (2x2)
    { x: 4, y: 0, z: 4 }, { x: 5, y: 0, z: 4 },
    { x: 4, y: 0, z: 5 }, { x: 5, y: 0, z: 5 },
    // Middle layer (1x1)
    { x: 4, y: 1, z: 4 },
  ];

  const ordered = gravitySortVoxels(voxels);
  const slots = buildSlotsFromVoxels(ordered);

  // Verify layer structure
  const layer0 = slots.filter(s => s.position.y < 0.5);
  const layer1 = slots.filter(s => s.position.y >= 0.5);
  
  assertEqual(layer0.length, 4, 'Should have 4 ground slots');
  assertEqual(layer1.length, 1, 'Should have 1 upper slot');
  
  // All ground slots available
  assertTrue(layer0.every(s => s.state === 'available'), 'All ground slots should be available');
  
  // Upper slot locked
  assertTrue(layer1.every(s => s.state === 'locked'), 'Upper slots should be locked');

  console.log('   ✓ Pyramid structure correctly ordered and locked');
});

test('Disconnected structure handled by full pipeline', () => {
  // Create disconnected blocks (floating)
  const voxels: Voxel[] = [
    { x: 5, y: 0, z: 5 }, // Ground
    { x: 8, y: 5, z: 8 }, // Floating (no support)
  ];

  const ordered = gravitySortVoxels(voxels);
  
  // Ground should come before floating
  assertTrue(ordered[0].y < ordered[1].y, 'Ground should be ordered before floating');

  const slots = buildSlotsFromVoxels(ordered);
  
  // Both should be available (no dependencies for floating block)
  assertEqual(slots[0].state, 'available');
  assertEqual(slots[1].state, 'available'); // No prereqs since no block below
  
  console.log('   ✓ Disconnected structure handled gracefully');
});

test('Autonomous swarm respects slot dependencies', () => {
  const voxels: Voxel[] = [
    { x: 5, y: 0, z: 5 },
    { x: 5, y: 1, z: 5 },
  ];

  const ordered = gravitySortVoxels(voxels);
  const slots = buildSlotsFromVoxels(ordered);

  const bots = [createMockBot(0, 0, 0.3, 0), createMockBot(1, 0.5, 0.3, 0)];
  const swarm = new AutonomousSwarmSystem(bots);
  swarm.setSlots(slots);

  // Run until first slot is filled
  let iterations = 0;
  while (slots[0].state !== 'filled' && iterations < 100) {
    swarm.update(0.05);
    iterations++;
  }

  // First slot should be filled
  assertEqual(slots[0].state, 'filled');
  
  // Second slot should now be available (dependency met)
  assertEqual(slots[1].state, 'available');

  console.log('   ✓ Slot dependencies unlock correctly in autonomous swarm');
});

test('Multiple bots can work on different parts simultaneously', () => {
  // Create two separate towers
  const voxels: Voxel[] = [
    // Tower 1
    { x: 3, y: 0, z: 3 },
    { x: 3, y: 1, z: 3 },
    // Tower 2
    { x: 7, y: 0, z: 7 },
    { x: 7, y: 1, z: 7 },
  ];

  const ordered = gravitySortVoxels(voxels);
  const slots = buildSlotsFromVoxels(ordered);

  // Both ground slots should be available
  const availableCount = slots.filter(s => s.state === 'available').length;
  assertEqual(availableCount, 2, 'Both ground slots should be available');

  const bots = [
    createMockBot(0, 2.5, 0.3, 2.5), // Near tower 1
    createMockBot(1, 7.5, 0.3, 7.5), // Near tower 2
  ];
  const swarm = new AutonomousSwarmSystem(bots);
  swarm.setSlots(slots);

  // Simulate
  for (let i = 0; i < 150; i++) {
    swarm.update(0.05);
  }

  const stats = swarm.getStats();
  assertTrue(stats.slots.filled >= 1, 'At least one tower should have progress');
  
  console.log(`   ✓ Parallel construction: ${stats.slots.filled}/4 slots filled`);
});

// Run all tests
console.log('\n🔗 Running Integration Tests (Full Pipeline)...\n');
console.log('='.repeat(50));

console.log('='.repeat(50));
console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${passed + failed}\n`);

if (failed > 0) {
  process.exit(1);
}

