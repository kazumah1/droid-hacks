# Assembly JSON Format Documentation

## Overview

The Claude AI integration generates structured JSON files that break down complex structures into logical components for assembly. Each component includes voxel coordinates, dependencies, and assembly order.

## JSON Structure

```json
{
  "name": "Structure Name",
  "description": "Brief description of the structure",
  "gridSize": {
    "x": 10,
    "y": 10,
    "z": 10
  },
  "totalVoxels": 100,
  "components": [
    {
      "id": "unique_component_id",
      "name": "Component Display Name",
      "description": "What this component represents",
      "voxels": [
        {"x": 0, "y": 0, "z": 0},
        {"x": 1, "y": 0, "z": 0}
      ],
      "dependencies": ["other_component_id"],
      "assemblyOrder": 1
    }
  ],
  "buildStrategy": "Description of construction approach",
  "estimatedTime": "~60 seconds"
}
```

## Field Descriptions

### Root Level

- **name** (string): Human-readable name of the structure
- **description** (string): Brief description of what the structure represents
- **gridSize** (object): Maximum dimensions of the 3D grid
  - `x`, `y`, `z`: Integer values (typically 10 for a 10x10x10 grid)
- **totalVoxels** (number): Total count of all voxels across all components
- **buildStrategy** (string): High-level description of the construction approach
- **estimatedTime** (string): Approximate time to complete assembly

### Component Object

Each component represents a logical part of the structure:

- **id** (string): Unique identifier for the component
  - Used for dependency tracking
  - Should be descriptive (e.g., "foundation", "north_wall", "tower_apex")
  
- **name** (string): Display name for the component
  - Human-readable label
  
- **description** (string): Detailed description of the component's role
  
- **voxels** (array): List of voxel coordinates
  - Each voxel is an object with `x`, `y`, `z` integer coordinates
  - Coordinates range from 0 to 9 (inclusive)
  - `y=0` is the ground level
  
- **dependencies** (array): List of component IDs that must be built first
  - Empty array `[]` for foundation/base components
  - Ensures gravity-stable construction
  
- **assemblyOrder** (number): Integer indicating build sequence
  - Starts at 1
  - Components with lower numbers are built first

## Usage Examples

### Simple Pyramid

```json
{
  "name": "Simple Pyramid",
  "description": "A 3-level pyramid structure",
  "gridSize": {"x": 10, "y": 10, "z": 10},
  "totalVoxels": 14,
  "components": [
    {
      "id": "base_layer",
      "name": "Base Layer",
      "description": "Foundation base (3x3)",
      "voxels": [
        {"x": 4, "y": 0, "z": 4}, {"x": 5, "y": 0, "z": 4},
        {"x": 6, "y": 0, "z": 4}, {"x": 4, "y": 0, "z": 5}
      ],
      "dependencies": [],
      "assemblyOrder": 1
    },
    {
      "id": "middle_layer",
      "name": "Middle Layer",
      "description": "Middle section (2x2)",
      "voxels": [
        {"x": 4, "y": 1, "z": 4}, {"x": 5, "y": 1, "z": 4}
      ],
      "dependencies": ["base_layer"],
      "assemblyOrder": 2
    },
    {
      "id": "apex",
      "name": "Apex",
      "description": "Top cap",
      "voxels": [{"x": 5, "y": 2, "z": 5}],
      "dependencies": ["middle_layer"],
      "assemblyOrder": 3
    }
  ],
  "buildStrategy": "Bottom-up construction with each layer built before the next",
  "estimatedTime": "~30 seconds"
}
```

### House Structure

```json
{
  "name": "Simple House",
  "description": "A basic house with foundation, walls, and roof",
  "gridSize": {"x": 10, "y": 10, "z": 10},
  "totalVoxels": 45,
  "components": [
    {
      "id": "foundation",
      "name": "Foundation",
      "description": "Base floor of the house (4x4)",
      "voxels": [
        {"x": 3, "y": 0, "z": 3}, {"x": 4, "y": 0, "z": 3},
        {"x": 3, "y": 0, "z": 4}, {"x": 4, "y": 0, "z": 4}
      ],
      "dependencies": [],
      "assemblyOrder": 1
    },
    {
      "id": "walls",
      "name": "Walls",
      "description": "Perimeter walls (2 blocks high)",
      "voxels": [
        {"x": 3, "y": 1, "z": 3}, {"x": 4, "y": 1, "z": 3},
        {"x": 3, "y": 2, "z": 3}, {"x": 4, "y": 2, "z": 3}
      ],
      "dependencies": ["foundation"],
      "assemblyOrder": 2
    },
    {
      "id": "roof",
      "name": "Roof",
      "description": "Peaked roof structure",
      "voxels": [
        {"x": 3, "y": 3, "z": 3}, {"x": 4, "y": 3, "z": 3}
      ],
      "dependencies": ["walls"],
      "assemblyOrder": 3
    }
  ],
  "buildStrategy": "Foundation first, then walls, finally roof - standard building construction",
  "estimatedTime": "~45 seconds"
}
```

## Component Design Patterns

### Foundation Components
- Always have `assemblyOrder: 1`
- No dependencies (`dependencies: []`)
- Located at `y: 0` (ground level)
- Form the stable base

### Support Components
- Built after foundation
- Provide vertical support for upper structures
- Dependencies point to foundation or lower support

### Detail Components
- Often the last to be assembled
- Multiple dependencies
- Add finishing touches or decorative elements

## Best Practices

1. **Logical Grouping**: Break structures into meaningful components
   - Foundation, walls, roof (for buildings)
   - Base, shaft, top (for towers)
   - Supports, deck, railings (for bridges)

2. **Dependency Chains**: Ensure stable construction
   - Nothing floats in mid-air
   - Components depend on their physical supports
   - Follow gravity rules

3. **Assembly Order**: Number sequentially
   - Start at 1 for foundation
   - Increment for each logical build step
   - Can have multiple components at the same order level if they're independent

4. **Component IDs**: Use descriptive names
   - Good: `"north_wall"`, `"tower_base"`, `"roof_apex"`
   - Bad: `"comp1"`, `"part_a"`, `"thing"`

5. **Coordinate System**:
   - X: Horizontal (left-right)
   - Y: Vertical (up-down, 0 = ground)
   - Z: Horizontal (forward-back)

## Integration with Swarm

The generated JSON is used by the swarm system to:

1. **Validate** the structure (gravity-stable, within bounds)
2. **Sort** voxels using stigmergy (gravity-based ordering)
3. **Create slots** from ordered voxels
4. **Assign bots** to available slots based on dependencies
5. **Build** component by component in the specified order

The component breakdown helps the swarm system optimize:
- Parallelization (independent components can build simultaneously)
- Resource allocation (bots per component)
- Progress tracking (component completion status)
- Error recovery (retry failed components)

## File Naming Convention

Generated files follow this pattern:
```
assembly_[structure_name]_[timestamp].json
```

Example: `assembly_simple_pyramid_1700000000000.json`

