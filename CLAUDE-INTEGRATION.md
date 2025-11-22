# Claude AI Integration for Assembly Generation

## Overview

This project integrates **Anthropic's Claude AI** to generate component-based assembly instructions for programmable matter swarms. Claude analyzes natural language commands and produces structured JSON files with coordinates, components, dependencies, and build orders.

## What It Does

Given a command like **"build a tower with a wide base and observation deck"**, Claude:

1. **Analyzes** the structure requirements
2. **Breaks down** the structure into logical components (foundation, shaft, deck, etc.)
3. **Generates** precise 3D voxel coordinates for each component
4. **Defines** dependencies between components (what must be built first)
5. **Outputs** a structured JSON file with complete assembly instructions

## Architecture

```
User Command
     ↓
Claude 3.5 Sonnet
     ↓
Component-Based JSON
     ↓
Assembly Planner
     ↓
Stigmergy Engine
     ↓
Swarm Controller
     ↓
3D Visualization
```

## Key Features

### 1. Component-Based Decomposition

Instead of just a flat list of voxels, Claude generates **logical components**:

```json
{
  "components": [
    {
      "id": "foundation",
      "name": "Foundation Base",
      "description": "Wide stable foundation (4x4 platform)",
      "voxels": [...],
      "dependencies": [],
      "assemblyOrder": 1
    },
    {
      "id": "tower_shaft",
      "name": "Tower Shaft",
      "description": "Vertical support column",
      "voxels": [...],
      "dependencies": ["foundation"],
      "assemblyOrder": 2
    }
  ]
}
```

### 2. Dependency Management

Each component declares what it depends on:
- Foundation has no dependencies `[]`
- Walls depend on foundation `["foundation"]`
- Roof depends on walls `["north_wall", "south_wall", "east_wall", "west_wall"]`

This ensures **gravity-stable** construction.

### 3. Assembly Order

Components are numbered sequentially for build order:
- Order 1: Foundation components
- Order 2: First-floor walls
- Order 3: Second-floor or roof
- Order 4+: Details and decorations

### 4. Metadata & Instructions

Each assembly plan includes:
- **Build Strategy**: High-level construction approach
- **Estimated Time**: Approximate assembly duration
- **Grid Size**: Dimensions of the build space
- **Total Voxels**: Complete block count

## API Integration

### Client-Side Generation

```typescript
import { generateAssemblyPlan } from '@/app/lib/ai-assembly';

const plan = await generateAssemblyPlan('build a pyramid temple');
console.log(plan.components);
```

### Server-Side API Route

```bash
POST /api/generate-assembly
Content-Type: application/json

{
  "command": "build a bridge with two support towers"
}
```

Response:
```json
{
  "name": "Bridge Structure",
  "description": "...",
  "components": [...],
  "buildStrategy": "...",
  "estimatedTime": "~50 seconds"
}
```

## Claude Prompt Engineering

The system uses a carefully crafted prompt that:

1. **Defines the coordinate system** (10x10x10 grid, y=0 is ground)
2. **Specifies the JSON schema** exactly
3. **Provides examples** of good component breakdowns
4. **Sets constraints** (gravity rules, connectivity)
5. **Requests creativity** within engineering constraints

Key prompt sections:
```
- Break complex structures into logical components
- Each component should form a meaningful part
- Use dependencies to ensure stable construction
- Component IDs should be descriptive
- All voxels must be within 0-9 range
```

## Model Selection

Currently uses **Claude 3.5 Sonnet** (`claude-3-5-sonnet-20241022`) for:
- Better spatial reasoning
- More consistent JSON output
- Creative yet practical designs
- Good balance of cost/performance

Alternative models:
- **Claude 3 Haiku**: Faster, cheaper, simpler structures
- **Claude 3 Opus**: Most capable, best for complex designs

## Error Handling & Fallbacks

The system includes robust error handling:

1. **API Key Check**: Validates environment variable
2. **Response Parsing**: Extracts JSON from Claude's response
3. **Validation**: Sanitizes coordinates, checks structure
4. **Fallback Plan**: Returns a simple pyramid if generation fails

```typescript
try {
  const plan = await generateAssemblyPlan(command);
  // Use plan
} catch (error) {
  // Fallback to simple pyramid structure
  return fallbackPlan;
}
```

## JSON Export & Download

Generated plans are automatically downloaded as JSON files:

```typescript
downloadAssemblyPlan(plan, 'my_structure.json');
```

Files are timestamped and named based on the structure:
```
assembly_tower_structure_1700000000000.json
```

## Integration with Swarm System

The assembly JSON integrates seamlessly with the existing swarm:

1. **Convert to Voxels**: `assemblyPlanToVoxels(plan)`
2. **Gravity Sort**: `gravitySortVoxels(voxels)`
3. **Create Slots**: `buildSlotsFromVoxels(ordered, cellSize)`
4. **Assign Bots**: Swarm controller uses slots
5. **Build**: Bots assemble according to dependencies

## Component Visualization

The system can visualize components in different colors:

```typescript
import { createComponentVisualizations } from '@/app/lib/component-visualizer';

const visualizations = createComponentVisualizations(plan, scene, cellSize);
```

Each component gets:
- Unique color (HSL-based palette)
- Individual meshes
- Wireframe edges
- Build progress tracking

## Human-Readable Instructions

Generate text-based instructions:

```typescript
import { generateAssemblyInstructions } from '@/app/lib/ai-assembly';

const instructions = generateAssemblyInstructions(plan);
console.log(instructions);
```

Output:
```
Assembly Instructions for Tower Structure
A tall tower with a wide base, narrow shaft, and observation deck

Strategy: Ground-up construction with stability
Estimated Time: ~60 seconds
Total Voxels: 37

Components (6):

1. Foundation Base (16 voxels)
   Wide stable foundation (4x4 platform)

2. Transition Layer (9 voxels)
   Transitional layer from wide base to narrow shaft
   Dependencies: foundation

...
```

## Validation

Validate assembly plans before use:

```typescript
import { validateAssemblyPlan } from '@/app/lib/component-visualizer';

const result = validateAssemblyPlan(plan);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
console.warn('Warnings:', result.warnings);
```

Checks for:
- Duplicate component IDs
- Invalid dependencies
- Circular dependencies
- Out-of-bounds coordinates
- Voxel count mismatches

## Cost Optimization

To minimize API costs:

1. **Use Haiku** for simple structures
2. **Cache** common plans locally
3. **Lower temperature** (0.3) for consistency
4. **Limit max_tokens** (4096 is usually enough)
5. **Implement rate limiting** for production

Current costs (approximate):
- Sonnet: ~$0.01-0.03 per generation
- Haiku: ~$0.001-0.003 per generation

## Example Commands

Try these with the "Generate Assembly JSON" button:

### Simple Structures
- `pyramid 5`
- `wall 10x4`
- `cube 6`

### Complex Structures
- `build a tall observation tower with a wide base`
- `create a bridge connecting two platforms`
- `make a house with foundation, walls, and peaked roof`
- `construct a castle with corner towers and connecting walls`
- `build a pyramid temple with entrance stairs`
- `create a multi-level parking structure`
- `make a lighthouse on a circular base`
- `build an arch spanning 5 units`

### Creative Structures
- `medieval watchtower with battlements`
- `modern skyscraper with setbacks`
- `ancient ziggurat with terraces`
- `suspension bridge with cables`
- `dome structure on pillars`

## Future Enhancements

Potential improvements:

1. **Import Custom JSON**: Load user-created assembly files
2. **Component Color Coding**: Visualize each component differently
3. **Progress Tracking**: Show per-component build progress
4. **Multi-Structure**: Coordinate multiple structures
5. **Optimization**: Claude suggests optimal build strategies
6. **Material Types**: Different voxel materials (stone, glass, metal)
7. **Assembly Simulation**: Preview build sequence
8. **Collision Detection**: Prevent overlapping structures
9. **Version History**: Track plan iterations
10. **Collaborative Building**: Multiple swarms, multiple structures

## Troubleshooting

### "Missing ANTHROPIC_API_KEY"
- Create `.env.local` file
- Add: `NEXT_PUBLIC_ANTHROPIC_API_KEY=your_key_here`
- Restart dev server

### "Failed to generate assembly plan"
- Check API key is valid
- Verify internet connection
- Check Claude API status
- Review console for detailed error

### Invalid JSON Response
- Claude sometimes adds commentary
- System extracts JSON automatically
- Falls back to simple pyramid if parsing fails

### Components Not Building
- Check dependencies are valid
- Verify coordinates are in bounds (0-9)
- Ensure no circular dependencies
- Validate with `validateAssemblyPlan()`

## Security Considerations

⚠️ **Important**: 
- `dangerouslyAllowBrowser: true` is set for client-side use
- For production, move to server-side API routes
- Don't expose API keys in client code
- Implement rate limiting
- Add user authentication

## Resources

- [Anthropic Documentation](https://docs.anthropic.com/)
- [Claude API Reference](https://docs.anthropic.com/claude/reference/)
- [Assembly JSON Format](./next-app/ASSEMBLY-JSON-FORMAT.md)
- [Example Files](./next-app/examples/)

## License

This integration is part of the droid-hacks project.

