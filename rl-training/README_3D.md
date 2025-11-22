# 3D RL Training - True Volumetric Learning

## What Changed from 2D → 3D

### Grid
- **Before**: 8×8 = 64 cells (flat)
- **Now**: 8×8×8 = 512 voxels (volumetric!)

### Actions
- **Before**: 4 movements + 2 block actions = 6 total
- **Now**: 6 movements + 2 block actions = 8 total
  - 0: Forward (-X)
  - 1: Right (+Z)
  - 2: Backward (+X)
  - 3: Left (-Z)
  - 4: Up (+Y) ← NEW!
  - 5: Down (-Y) ← NEW!
  - 6: Place block
  - 7: Pickup block

### Observations
- **Before**: 131 features (2 pos + 64 grid + 1 block + 64 target)
- **Now**: 1028 features (3 pos + 512 grid + 1 block + 512 target)

### Network
- **Before**: 64 hidden units, 2 layers
- **Now**: 128 hidden units, 3 layers (more capacity for 3D)

### Training Time
- **Before**: 20-30 min on GPU
- **Now**: 40-60 min on GPU (8× more states!)

## 3D Shapes Being Learned

1. **Pyramid** - Decreasing layers (4×4×4 → 3×3×3 → 2×2×2 → 1×1×1)
2. **Tower** - Vertical column
3. **Wall 3D** - Wall with height
4. **Cube** - Solid 3D cube
5. **Staircase** - Ascending steps
6. **Bridge** - Two pillars + platform
7. **Arch** - Support columns + top beam
8. **Platform** - Raised floor
9. **Random 3D** - Sparse 3D patterns

## Physics Constraints

- Agents can only move UP if there's a block below them (gravity!)
- Blocks can be placed at any height (simplified for training)
- Agents spawn at ground level (Y=0)

## Training Command

```bash
python train.py --episodes 600 --agents 5 --device cuda
```

**Expected learning curve:**
- Episode 0-100: Random, ~0-5% match
- Episode 100-300: Learning vertical movement, ~10-30%
- Episode 300-500: Building complete structures, ~40-70%
- Episode 500+: Expert 3D construction, ~70-85%

## Validation

```bash
python validate_logic.py
```

Should show:
- Observation size: 1028 ✅
- Action space: 8 actions ✅
- 3D targets with multiple Y layers ✅

## Integration

After training, the model outputs 3D voxel patterns that match your LLM voxel format:

```typescript
// RL output:
grid[x][y][z] = 1 or 0

// Converts directly to:
voxels = [{x, y, z}, ...]

// No projection needed!
```

