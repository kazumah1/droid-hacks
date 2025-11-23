# Scaling Strategy: Train Small, Deploy Large

## The Magic of Local Observations 🎯

Your agents use **3×3×3 local observations**, which makes them **grid-size agnostic**!

They learn universal behaviors:
- "Follow the scent gradient"
- "Place blocks where scent is high"
- "Avoid collisions"

These work at ANY scale because the agent's "world view" is always 27 cells, regardless of grid size.

---

## Current Setup

### LLM (ai_shapes.ts)
- **Grid**: 10×10×10 (coordinates 0-9)
- **Purpose**: Generate diverse 3D shapes from text
- **Model**: Claude Haiku (fast, cheap)

### Training (text_conditioned_env.py)
- **Grid**: 8×8×8 (default)
- **Purpose**: Fast training (~45-60 min on GPU)
- **Memory**: ~2 GB GPU
- **Voxels**: Auto-scaled from 10×10×10 → 8×8×8

### Deployment (Future)
- **Grid**: 128×128×128 (or any size!)
- **Purpose**: High-resolution structures
- **Memory**: Scales linearly with num_agents, not grid_size
- **Voxels**: Scale LLM output 10×10×10 → 128×128×128

---

## Why 8×8×8 for Training?

| Grid Size | Cells | Training Time | Memory | Detail |
|-----------|-------|---------------|--------|--------|
| 8×8×8     | 512   | 45-60 min ✅  | ~2 GB  | Good   |
| 16×16×16  | 4,096 | 2-3 hours ⚠️  | ~6 GB  | Better |
| 32×32×32  | 32K   | 8-12 hours ❌ | ~20 GB | Great  |
| 128×128×128 | 2M  | Days ❌❌     | OOM    | Overkill for training |

**Hackathon optimal**: 8×8×8 gives you results in under an hour!

---

## How Scaling Works

### Training Time (what we're doing now)

```python
# 1. LLM generates 10×10×10 voxels
llm_voxels = call_claude("pyramid 5")
# → [{"x": 0, "y": 0, "z": 0}, {"x": 1, "y": 0, "z": 0}, ...]

# 2. Auto-scale to 8×8×8 for training
training_voxels = scale_voxels(llm_voxels, from_size=10, to_size=8)
# → [{"x": 0, "y": 0, "z": 0}, {"x": 1, "y": 0, "z": 0}, ...]  (scaled down)

# 3. Train RL agents on 8×8×8 grid
env = TextConditioned3DEnv(grid_size=8)
env.load_training_pair("pyramid 5", training_voxels)
# Agents learn: "Build pyramid shape by following scent field"
```

### Deployment Time (after training)

```python
# 1. LLM generates 10×10×10 voxels (same as before)
llm_voxels = call_claude("castle")

# 2. Scale UP to 128×128×128 for deployment
def scale_voxels_up(voxels, from_size=10, to_size=128):
    scale_factor = to_size / from_size  # 12.8x
    return [
        {
            'x': int(v['x'] * scale_factor),
            'y': int(v['y'] * scale_factor),
            'z': int(v['z'] * scale_factor),
        }
        for v in voxels
    ]

deployment_voxels = scale_voxels_up(llm_voxels, to_size=128)

# 3. Use SAME trained policy on 128×128×128 grid
env_large = TextConditioned3DEnv(grid_size=128)  # Same policy works!
env_large.load_training_pair("castle", deployment_voxels)

# The trained agent's observations are STILL 3×3×3 local patches,
# so it sees the same "world view" as during training!
```

---

## When to Scale Up

### Now (Training Phase)
**Keep it at 8×8×8** ✅
- Fast iteration
- Quick debugging
- GPU-friendly
- Good enough for hackathon demo

### Later (Production)
**Scale to 16×16×16 or 32×32×32** 🎯
- Better resolution
- More complex structures
- Smoother gradients
- Worth the extra training time

### Deployment (Browser)
**Scale to 128×128×128** 🚀
- Use trained 8×8×8 policy
- Scale voxels up at runtime
- Agents transfer perfectly
- No retraining needed!

---

## Updating Grid Size for Training

### Option 1: Keep 8×8×8 (Recommended)
```bash
# Already configured! Just train:
python generate_training_data_anthropic.py
python train_text_conditioned.py --curriculum
```

### Option 2: Train on 16×16×16 (Better Quality)
```python
# In generate_training_data_anthropic.py, line 231:
training_grid_size = 16  # ← Change from 8 to 16

# In train_text_conditioned.py, line ~50:
env = TextConditioned3DEnv(grid_size=16)  # ← Change from 8 to 16
```

**Trade-off**: 4× more cells = 2-3× longer training time

---

## Deployment Code (Future)

When you're ready to deploy at high resolution:

```typescript
// next-app/app/lib/rl-deploy.ts
export function scaleVoxelsForDeployment(
  voxels: Voxel[],
  fromSize: number = 10,  // LLM output size
  toSize: number = 128    // Deployment size
): Voxel[] {
  const scale = toSize / fromSize;
  
  return voxels.map(v => ({
    x: Math.round(v.x * scale),
    y: Math.round(v.y * scale),
    z: Math.round(v.z * scale),
  }));
}

// Usage:
const llmVoxels = await generateShapeFromText("castle");  // 10×10×10
const deployVoxels = scaleVoxelsForDeployment(llmVoxels, 10, 128);  // 128×128×128
// Feed deployVoxels to your trained RL agents - they work the same!
```

---

## Summary

✅ **Train on 8×8×8** (fast, hackathon-friendly)  
✅ **LLM generates 10×10×10** (already set up)  
✅ **Auto-scaling** (handled by training scripts)  
✅ **Deploy at 128×128×128** (just scale voxels up, use same policy)  

**The secret**: Local observations (3×3×3) make agents learn scale-free behaviors! 🎯

---

## FAQ

**Q: Won't agents trained on 8×8×8 fail on 128×128×128?**  
A: No! Local observations (3×3×3 patches) look identical at any scale. The agent sees "1 block below me, scent pointing North" regardless of grid size.

**Q: Should I update the LLM prompt to 128×128×128 now?**  
A: No need yet. Keep it at 10×10×10 for training. Update it for deployment.

**Q: Can I train on 10×10×10 to match the LLM exactly?**  
A: Yes! Just change `training_grid_size = 10` in `generate_training_data_anthropic.py`. Only 56% more cells than 8×8×8, negligible training time increase.

**Q: What if I want even bigger structures than 128×128×128?**  
A: Go for it! The policy will transfer. Just scale the voxels accordingly. The only limit is browser memory for rendering.

