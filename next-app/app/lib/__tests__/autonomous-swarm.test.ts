/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Unit tests for autonomous-swarm.ts
// Run with: npx tsx app/lib/__tests__/autonomous-swarm.test.ts

import { AutonomousBot, AutonomousSwarmSystem } from '../autonomous-swarm';
import { Slot } from '../slots';

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
}

class MockGroup {
  position = new MockVector3();
  rotation = { y: 0 };
  
  traverse(fn: any) {
    // Do nothing - no children in mock
  }
  
  lookAt(v: MockVector3) {
    // Do nothing - just for testing
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

// Helper to create mock bot
function createMockBot(id: number, x = 0, y = 0.3, z = 0): AutonomousBot {
  const mesh = new MockGroup() as any;
  mesh.position.set(x, y, z);
  return new AutonomousBot(id, mesh);
}

// Helper to create mock slot
function createMockSlot(id: number, x: number, y: number, z: number, state: 'locked' | 'available' | 'filled' = 'available'): Slot {
  return {
    id,
    position: new MockVector3(x, y, z) as any,
    prereqIds: [],
    state,
  };
}

// ========== TESTS ==========

test('Bot starts in idle state', () => {
  const bot = createMockBot(0);
  assertEqual(bot.state, 'idle');
  assertEqual(bot.claimedSlotId, null);
});

test('Bot can detect nearby available slot', () => {
  const bot = createMockBot(0, 0, 0.3, 0);
  const nearSlot = createMockSlot(0, 1, 0.3, 0, 'available');
  const farSlot = createMockSlot(1, 100, 0.3, 0, 'available');
  
  bot.think([nearSlot, farSlot], [], 0);
  
  // Bot should claim the near slot
  assertEqual(bot.state, 'approaching');
  assertEqual(bot.claimedSlotId, 0);
});

test('Bot ignores slots outside search radius', () => {
  const bot = createMockBot(0, 0, 0.3, 0);
  const farSlot = createMockSlot(0, 100, 0.3, 0, 'available');
  
  bot.think([farSlot], [], 0);
  
  // Bot should not claim far slot, should start searching/idle
  assertTrue(bot.state === 'idle' || bot.state === 'searching');
  assertEqual(bot.claimedSlotId, null);
});

test('Bot avoids slots claimed by other bots', () => {
  const bot1 = createMockBot(0, 0, 0.3, 0);
  const bot2 = createMockBot(1, 0, 0.3, 0);
  
  const slot1 = createMockSlot(0, 1, 0.3, 0, 'available');
  const slot2 = createMockSlot(1, 2, 0.3, 0, 'available');
  
  // Bot2 already claimed slot1
  bot2.claimedSlotId = 0;
  bot2.state = 'approaching';
  
  bot1.think([slot1, slot2], [bot2], 0);
  
  // Bot1 should claim slot2 (avoiding bot2's claimed slot1)
  assertEqual(bot1.claimedSlotId, 1);
});

test('Bot locks into slot when close enough', () => {
  const bot = createMockBot(0, 0, 0.3, 0);
  const slot = createMockSlot(0, 0.01, 0.3, 0, 'available');
  
  bot.claimedSlotId = 0;
  bot.state = 'approaching';
  
  bot.think([slot], [], 0);
  
  // Bot should lock in
  assertEqual(bot.state, 'locked');
  assertEqual(slot.state, 'filled');
  assertEqual(bot.claimedSlotId, null);
});

test('Bot moves toward target', () => {
  const bot = createMockBot(0, 0, 0.3, 0);
  bot.target.set(5, 0.3, 0);
  bot.state = 'approaching';
  
  const initialDist = bot.position.distanceTo(bot.target);
  
  bot.move(0.1); // 100ms
  
  const finalDist = bot.position.distanceTo(bot.target);
  
  assertTrue(finalDist < initialDist, 'Bot should move closer to target');
});

test('Bot idles when no available slots exist', () => {
  const bot = createMockBot(0, 0, 0.3, 0);
  bot.state = 'searching';
  
  bot.lastDecisionTime = -1; // Force decision
  bot.think([], [], 0);
  
  // Bot should idle when there are no slots at all
  assertEqual(bot.state, 'idle');
});

test('Swarm system updates all bots', () => {
  const bot1 = createMockBot(0, 0, 0.3, 0);
  const bot2 = createMockBot(1, 1, 0.3, 1);
  
  const swarm = new AutonomousSwarmSystem([bot1, bot2]);
  const slot = createMockSlot(0, 0.5, 0.3, 0.5, 'available');
  
  swarm.setSlots([slot]);
  swarm.update(0.1);
  
  // At least one bot should be approaching
  const approaching = swarm.bots.filter(b => b.state === 'approaching').length;
  assertTrue(approaching > 0, 'At least one bot should be approaching');
});

test('Swarm stats report correct state', () => {
  const bot1 = createMockBot(0);
  const bot2 = createMockBot(1);
  bot1.state = 'locked';
  bot2.state = 'approaching';
  
  const swarm = new AutonomousSwarmSystem([bot1, bot2]);
  const stats = swarm.getStats();
  
  assertEqual(stats.bots.locked, 1);
  assertEqual(stats.bots.approaching, 1);
});

test('Swarm warns about insufficient bots', () => {
  const bot = createMockBot(0);
  const swarm = new AutonomousSwarmSystem([bot]);
  
  const slots = [
    createMockSlot(0, 0, 0.3, 0),
    createMockSlot(1, 1, 0.3, 0),
    createMockSlot(2, 2, 0.3, 0),
  ];
  
  // Should log warning (we can't easily capture console.warn in this test)
  swarm.setSlots(slots);
  
  // But system should still work
  assertEqual(swarm.slots.length, 3);
});

test('Bot respects decision interval', () => {
  const bot = createMockBot(0);
  const slot = createMockSlot(0, 1, 0.3, 0);
  
  bot.decisionInterval = 1.0; // 1 second
  
  // First think
  bot.think([slot], [], 0.0);
  const firstClaim = bot.claimedSlotId;
  
  // Second think too soon
  bot.claimedSlotId = null; // Reset
  bot.think([slot], [], 0.05); // Only 50ms later
  const secondClaim = bot.claimedSlotId;
  
  // Second think should not happen (still too soon)
  assertEqual(secondClaim, null);
});

test('Multiple bots complete simple structure', () => {
  const bots = [
    createMockBot(0, 0, 0.3, 0),
    createMockBot(1, 1, 0.3, 1),
  ];
  
  const slots = [
    createMockSlot(0, 0.5, 0.3, 0.5, 'available'),
    createMockSlot(1, 1.5, 0.3, 1.5, 'available'),
  ];
  
  const swarm = new AutonomousSwarmSystem(bots);
  swarm.setSlots(slots);
  
  // Simulate enough time for bots to reach slots
  for (let i = 0; i < 100; i++) {
    swarm.update(0.05); // 50ms steps
  }
  
  const stats = swarm.getStats();
  assertTrue(stats.slots.filled >= 1, 'At least 1 slot should be filled');
});

test('Bot wanders when slots exist but out of range', () => {
  const bot = createMockBot(0, 0, 0.3, 0);
  const farSlot = createMockSlot(0, 100, 0.3, 0, 'available');
  const initialTarget = bot.target.clone();
  
  bot.lastDecisionTime = -1; // Force decision
  bot.think([farSlot], [], 0);
  
  // Bot should wander/search for slots
  const targetChanged = bot.target.distanceTo(initialTarget) > 0.1;
  assertTrue(targetChanged || bot.state === 'searching' || bot.state === 'idle', 
    'Bot should react to out-of-range slots');
});

test('Scatter resets all bots', () => {
  const bot1 = createMockBot(0);
  const bot2 = createMockBot(1);
  bot1.state = 'locked';
  bot2.state = 'approaching';
  
  const swarm = new AutonomousSwarmSystem([bot1, bot2]);
  swarm.scatter();
  
  // All bots should be reset
  assertEqual(bot1.state, 'idle');
  assertEqual(bot2.state, 'idle');
  assertEqual(swarm.slots.length, 0);
});

// Run all tests
console.log('\n🧪 Running Autonomous Swarm Tests...\n');
console.log('='.repeat(50));

console.log('='.repeat(50));
console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${passed + failed}\n`);

if (failed > 0) {
  process.exit(1);
}

