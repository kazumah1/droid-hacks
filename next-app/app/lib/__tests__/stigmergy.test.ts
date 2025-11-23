/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Unit tests for stigmergy.ts
// Run with: npx tsx app/lib/__tests__/stigmergy.test.ts
// Or: node --loader ts-node/esm app/lib/__tests__/stigmergy.test.ts

import { gravitySortVoxels, Voxel, OrderedVoxel } from '../stigmergy';

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

test('Empty voxel array returns empty order', () => {
  const result = gravitySortVoxels([]);
  assertEqual(result.length, 0);
});

test('Single ground voxel is immediately available', () => {
  const voxels: Voxel[] = [{ x: 0, y: 0, z: 0 }];
  const result = gravitySortVoxels(voxels);
  
  assertEqual(result.length, 1);
  assertEqual(result[0].x, 0);
  assertEqual(result[0].y, 0);
  assertEqual(result[0].z, 0);
  assertEqual(result[0].index, 0);
});

test('Two ground voxels are both placed first', () => {
  const voxels: Voxel[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
  ];
  const result = gravitySortVoxels(voxels);
  
  assertEqual(result.length, 2);
  // Both should have low indices (0 or 1) since they're both ground level
  assertTrue(result[0].index <= 1);
  assertTrue(result[1].index <= 1);
});

test('Simple tower: ground then upper blocks', () => {
  const voxels: Voxel[] = [
    { x: 0, y: 2, z: 0 }, // Top
    { x: 0, y: 1, z: 0 }, // Middle
    { x: 0, y: 0, z: 0 }, // Ground
  ];
  const result = gravitySortVoxels(voxels);
  
  assertEqual(result.length, 3);
  
  // Find each voxel in result
  const ground = result.find(v => v.y === 0)!;
  const middle = result.find(v => v.y === 1)!;
  const top = result.find(v => v.y === 2)!;
  
  // Verify order: ground < middle < top
  assertTrue(ground.index < middle.index, 'Ground should come before middle');
  assertTrue(middle.index < top.index, 'Middle should come before top');
});

test('Two towers build independently', () => {
  const voxels: Voxel[] = [
    // Tower 1
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 },
    // Tower 2
    { x: 2, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 },
  ];
  const result = gravitySortVoxels(voxels);
  
  assertEqual(result.length, 5);
  
  // Both ground blocks should come before any upper blocks
  const grounds = result.filter(v => v.y === 0);
  const uppers = result.filter(v => v.y > 0);
  
  const maxGroundIndex = Math.max(...grounds.map(v => v.index));
  const minUpperIndex = Math.min(...uppers.map(v => v.index));
  
  assertTrue(maxGroundIndex < minUpperIndex, 'All ground blocks should be placed before upper blocks');
});

test('Pyramid builds layer by layer', () => {
  const voxels: Voxel[] = [
    // Layer 0 (3x3)
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 },
    { x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }, { x: 2, y: 0, z: 2 },
    // Layer 1 (2x2) - only supported positions
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 },
    { x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 },
    // Layer 2 (1x1)
    { x: 0, y: 2, z: 0 },
  ];
  const result = gravitySortVoxels(voxels);
  
  assertEqual(result.length, 14);
  
  // Check each layer is placed before the next
  const layer0 = result.filter(v => v.y === 0);
  const layer1 = result.filter(v => v.y === 1);
  const layer2 = result.filter(v => v.y === 2);
  
  const maxLayer0Index = Math.max(...layer0.map(v => v.index));
  const minLayer1Index = Math.min(...layer1.map(v => v.index));
  const maxLayer1Index = Math.max(...layer1.map(v => v.index));
  const minLayer2Index = Math.min(...layer2.map(v => v.index));
  
  assertTrue(maxLayer0Index < minLayer1Index, 'Layer 0 before Layer 1');
  assertTrue(maxLayer1Index < minLayer2Index, 'Layer 1 before Layer 2');
});

test('Disconnected structure: floating blocks handled gracefully', () => {
  const voxels: Voxel[] = [
    { x: 0, y: 0, z: 0 }, // Ground block
    { x: 5, y: 5, z: 5 }, // Floating block (no support)
  ];
  const result = gravitySortVoxels(voxels);
  
  assertEqual(result.length, 2);
  
  // Ground should still come first
  const ground = result.find(v => v.y === 0)!;
  const floating = result.find(v => v.y === 5)!;
  
  assertTrue(ground.index < floating.index, 'Ground should be placed before floating block');
});

test('Complex disconnected structure: processes by layer', () => {
  const voxels: Voxel[] = [
    { x: 0, y: 0, z: 0 }, // Ground
    { x: 5, y: 3, z: 5 }, // Floating at y=3
    { x: 6, y: 3, z: 5 }, // Floating at y=3
    { x: 8, y: 5, z: 8 }, // Floating at y=5
  ];
  const result = gravitySortVoxels(voxels);
  
  assertEqual(result.length, 4);
  
  // Should process: y=0, then y=3 (both blocks), then y=5
  const y0 = result.filter(v => v.y === 0);
  const y3 = result.filter(v => v.y === 3);
  const y5 = result.filter(v => v.y === 5);
  
  assertTrue(y0[0].index === 0, 'Ground at index 0');
  assertTrue(y3[0].index > y0[0].index, 'y=3 after ground');
  assertTrue(y5[0].index > Math.max(...y3.map(v => v.index)), 'y=5 after y=3');
});

test('No duplicate indices assigned', () => {
  const voxels: Voxel[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
  ];
  const result = gravitySortVoxels(voxels);
  
  const indices = result.map(v => v.index);
  const uniqueIndices = new Set(indices);
  
  assertEqual(indices.length, uniqueIndices.size, 'All indices should be unique');
});

test('Indices are sequential starting from 0', () => {
  const voxels: Voxel[] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 },
  ];
  const result = gravitySortVoxels(voxels);
  
  const indices = result.map(v => v.index).sort((a, b) => a - b);
  assertEqual(indices, [0, 1, 2]);
});

test('All input voxels appear in output', () => {
  const voxels: Voxel[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 5, y: 5, z: 5 },
  ];
  const result = gravitySortVoxels(voxels);
  
  assertEqual(result.length, voxels.length, 'All voxels should be in output');
  
  // Check each input voxel has a match in output
  for (const v of voxels) {
    const found = result.find(r => r.x === v.x && r.y === v.y && r.z === v.z);
    assertTrue(!!found, `Voxel (${v.x},${v.y},${v.z}) should be in output`);
  }
});

test('Large pyramid (stress test)', () => {
  const voxels: Voxel[] = [];
  const size = 10;
  
  for (let y = 0; y < size; y++) {
    const layerSize = size - y;
    for (let x = 0; x < layerSize; x++) {
      for (let z = 0; z < layerSize; z++) {
        voxels.push({ x, y, z });
      }
    }
  }
  
  const result = gravitySortVoxels(voxels);
  
  assertEqual(result.length, voxels.length);
  
  // Verify layered ordering
  for (let y = 0; y < size - 1; y++) {
    const currentLayer = result.filter(v => v.y === y);
    const nextLayer = result.filter(v => v.y === y + 1);
    
    const maxCurrentIndex = Math.max(...currentLayer.map(v => v.index));
    const minNextIndex = Math.min(...nextLayer.map(v => v.index));
    
    assertTrue(
      maxCurrentIndex < minNextIndex,
      `Layer ${y} should complete before layer ${y + 1}`
    );
  }
});

// Run all tests
console.log('\n🧪 Running Stigmergy Tests...\n');
console.log('='.repeat(50));

// Summary
console.log('='.repeat(50));
console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total:  ${passed + failed}\n`);

if (failed > 0) {
  process.exit(1);
}

