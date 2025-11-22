/**
 * Test script for assembly generation
 * 
 * Run with: npx ts-node scripts/test-assembly.ts
 */

// Note: This is a demo script showing how to use the assembly system
// For actual usage, run the Next.js app and use the UI

interface AssemblyPlan {
  name: string;
  description: string;
  components: Array<{
    id: string;
    name: string;
    voxels: Array<{ x: number; y: number; z: number }>;
    dependencies: string[];
    assemblyOrder: number;
  }>;
}

// Example: Create a simple pyramid assembly plan
const examplePyramid: AssemblyPlan = {
  name: 'Simple Pyramid',
  description: 'A 3-level pyramid structure',
  components: [
    {
      id: 'base_layer',
      name: 'Base Layer',
      voxels: [
        { x: 4, y: 0, z: 4 }, { x: 5, y: 0, z: 4 }, { x: 6, y: 0, z: 4 },
        { x: 4, y: 0, z: 5 }, { x: 5, y: 0, z: 5 }, { x: 6, y: 0, z: 5 },
        { x: 4, y: 0, z: 6 }, { x: 5, y: 0, z: 6 }, { x: 6, y: 0, z: 6 },
      ],
      dependencies: [],
      assemblyOrder: 1,
    },
    {
      id: 'middle_layer',
      name: 'Middle Layer',
      voxels: [
        { x: 4, y: 1, z: 4 }, { x: 5, y: 1, z: 4 },
        { x: 4, y: 1, z: 5 }, { x: 5, y: 1, z: 5 },
      ],
      dependencies: ['base_layer'],
      assemblyOrder: 2,
    },
    {
      id: 'apex',
      name: 'Apex',
      voxels: [{ x: 5, y: 2, z: 5 }],
      dependencies: ['middle_layer'],
      assemblyOrder: 3,
    },
  ],
};

// Validate assembly plan
function validatePlan(plan: AssemblyPlan): boolean {
  console.log(`\n=== Validating: ${plan.name} ===`);
  console.log(`Description: ${plan.description}`);
  console.log(`Components: ${plan.components.length}\n`);

  let totalVoxels = 0;
  const componentIds = new Set<string>();

  plan.components.forEach((component, index) => {
    console.log(`${index + 1}. ${component.name} (${component.id})`);
    console.log(`   Voxels: ${component.voxels.length}`);
    console.log(`   Dependencies: ${component.dependencies.join(', ') || 'none'}`);
    console.log(`   Assembly Order: ${component.assemblyOrder}`);

    totalVoxels += component.voxels.length;
    componentIds.add(component.id);

    // Validate dependencies exist
    component.dependencies.forEach(depId => {
      if (!componentIds.has(depId)) {
        // Check if it will exist later
        const exists = plan.components.some(c => c.id === depId);
        if (!exists) {
          console.warn(`   ⚠️  Invalid dependency: ${depId}`);
        }
      }
    });

    console.log('');
  });

  console.log(`Total Voxels: ${totalVoxels}`);
  console.log(`✅ Validation complete\n`);

  return true;
}

// Generate build instructions
function generateInstructions(plan: AssemblyPlan): void {
  console.log(`\n=== Assembly Instructions: ${plan.name} ===\n`);

  const sorted = [...plan.components].sort((a, b) => a.assemblyOrder - b.assemblyOrder);

  sorted.forEach(component => {
    console.log(`Step ${component.assemblyOrder}: Build ${component.name}`);
    if (component.dependencies.length > 0) {
      console.log(`  Prerequisites: ${component.dependencies.join(', ')}`);
    }
    console.log(`  Voxels to place: ${component.voxels.length}`);
    console.log('');
  });
}

// Main execution
function main() {
  console.log('🤖 Assembly Plan Test Script\n');
  console.log('This script demonstrates the assembly plan structure.');
  console.log('For actual AI generation, use the Next.js app.\n');

  validatePlan(examplePyramid);
  generateInstructions(examplePyramid);

  console.log('📝 To generate with Claude AI:');
  console.log('   1. Run: npm run dev');
  console.log('   2. Open: http://localhost:3000');
  console.log('   3. Click: "✨ Generate Assembly JSON"');
  console.log('   4. Enter command: "build a tower with observation deck"');
  console.log('   5. Watch JSON download and structure build!\n');

  console.log('📚 Example files available:');
  console.log('   - examples/assembly_tower.json');
  console.log('   - examples/assembly_bridge.json\n');
}

main();

