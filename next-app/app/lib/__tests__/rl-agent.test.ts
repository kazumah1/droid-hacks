// Basic tests for RL agent (without ONNX runtime)
// Run with: npx tsx app/lib/__tests__/rl-agent.test.ts

import { RLAgent, RLSwarmController } from '../rl-agent';

// Mock THREE.js
class MockVector3 {
  constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}
  clone() { return new MockVector3(this.x, this.y, this.z); }
  copy(v: MockVector3) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
}

class MockGroup {
  position = new MockVector3();
  traverse(fn: any) {}
}

(global as any).THREE = {
  Vector3: MockVector3,
  Group: MockGroup,
};

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

function assertEqual(actual: any, expected: any) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, msg?: string) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// Tests
test('RLAgent creates observation vector of correct size', () => {
  const mesh = new MockGroup() as any;
  const agent = new RLAgent(0, mesh, 8);
  
  const grid = Array(8).fill(0).map(() => Array(8).fill(0));
  const target = Array(8).fill(0).map(() => Array(8).fill(0));
  
  const obs = agent.getObservation(grid, target);
  assertEqual(obs.length, 131); // 2 + 64 + 1 + 64
});

test('RLAgent observation contains position', () => {
  const mesh = new MockGroup() as any;
  mesh.position.set(0, 0, 0);
  const agent = new RLAgent(0, mesh, 8);
  agent.gridPosition = [3, 5];
  
  const grid = Array(8).fill(0).map(() => Array(8).fill(0));
  const target = Array(8).fill(0).map(() => Array(8).fill(0));
  
  const obs = agent.getObservation(grid, target);
  
  // First two values are normalized position
  assertTrue(obs[0] === 3 / 8);
  assertTrue(obs[1] === 5 / 8);
});

test('RLAgent can execute movement actions', () => {
  const mesh = new MockGroup() as any;
  mesh.position.set(0, 0, 0);
  const agent = new RLAgent(0, mesh, 8);
  agent.gridPosition = [4, 4];
  agent.position = new MockVector3(0, 0, 0) as any;
  
  const grid = Array(8).fill(0).map(() => Array(8).fill(0));
  
  // Move up (action 0)
  agent.executeAction(0, grid);
  assertEqual(agent.gridPosition[0], 3);
  
  // Move right (action 1)
  agent.executeAction(1, grid);
  assertEqual(agent.gridPosition[1], 5);
});

test('RLAgent can place blocks', () => {
  const mesh = new MockGroup() as any;
  const agent = new RLAgent(0, mesh, 8);
  agent.gridPosition = [4, 4];
  agent.hasBlock = true;
  
  const grid = Array(8).fill(0).map(() => Array(8).fill(0));
  
  // Place block (action 4)
  agent.executeAction(4, grid);
  
  assertEqual(agent.hasBlock, false);
  assertEqual(grid[4][4], 1.0);
});

test('RLAgent respects grid boundaries', () => {
  const mesh = new MockGroup() as any;
  const agent = new RLAgent(0, mesh, 8);
  agent.gridPosition = [0, 0];
  
  const grid = Array(8).fill(0).map(() => Array(8).fill(0));
  
  // Try to move up from top edge
  agent.executeAction(0, grid);
  assertEqual(agent.gridPosition[0], 0); // Should not move
  
  // Try to move left from left edge
  agent.executeAction(3, grid);
  assertEqual(agent.gridPosition[1], 0); // Should not move
});

test('RLSwarmController creates correct target', () => {
  const mesh = new MockGroup() as any;
  const agents = [new RLAgent(0, mesh), new RLAgent(1, mesh)];
  const controller = new RLSwarmController(agents, 8);
  
  const target = controller.target;
  
  // Should have blocks in center (pyramid base)
  const center = 4;
  assertTrue(target[center][center] > 0);
  assertTrue(target[center-1][center] > 0);
  assertTrue(target[center+1][center] > 0);
});

test('RLSwarmController calculates match score correctly', () => {
  const mesh = new MockGroup() as any;
  const agents = [new RLAgent(0, mesh)];
  const controller = new RLSwarmController(agents, 8);
  
  // No blocks placed - score should be 0
  let score = controller.getMatchScore();
  assertEqual(score, 0);
  
  // Place some blocks in target positions
  const center = 4;
  controller.grid[center][center] = 1.0;
  controller.grid[center-1][center] = 1.0;
  
  score = controller.getMatchScore();
  assertTrue(score > 0 && score < 1); // Partial completion
});

test('Sample action picks from distribution correctly', () => {
  const mesh = new MockGroup() as any;
  const agent = new RLAgent(0, mesh);
  
  // Deterministic distribution (100% for action 2)
  const probs = [0, 0, 1.0, 0, 0, 0];
  const action = agent.sampleAction(probs);
  assertEqual(action, 2);
});

console.log('\n🧪 Running RL Agent Tests...\n');
console.log('='.repeat(50));
console.log('='.repeat(50));
console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${passed + failed}\n`);

if (failed > 0) process.exit(1);

