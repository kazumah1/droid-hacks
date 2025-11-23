# 🔥 TEXT-CONDITIONED RL TRAINING

## Architecture

```
Text: "pyramid"
    ↓
LLM API (YOUR EXISTING CODE)
    ↓
Voxels: [{x:0,y:0,z:0}, ...]
    ↓
RL Environment (scent fields + local obs)
    ↓
Text-Conditioned Policy (vision + language)
    ↓
Actions → Build Structure!
```

## Step 1: Generate Training Data (5 min)

```bash
cd rl-training

# Install new dependencies
pip install sentence-transformers scipy

# Generate text-voxel pairs using YOUR LLM
python generate_training_pairs.py
```

**TO USE YOUR REAL LLM:**
Edit `generate_training_pairs.py` line 98-99:
```python
# Uncomment these lines and add your API integration:
from lib.ai_shapes import generateShapeFromText
voxels = await generateShapeFromText(prompt)
```

This creates `data/training_pairs.json` with 30+ text-voxel pairs.

## Step 2: Train Text-Conditioned Agents (45-60 min)

```bash
# With curriculum learning (recommended)
python train_text_conditioned.py --episodes 600 --agents 5 --device cuda --curriculum

# Without curriculum (faster but less reliable)
python train_text_conditioned.py --episodes 400 --agents 5 --device cuda
```

**What's happening:**
- Agents get LOCAL 3×3×3 observations (not full grid)
- SCENT FIELDS guide them toward targets (solves sparse rewards!)
- TEXT EMBEDDINGS condition behavior ("pyramid" → build upward)
- Curriculum: trains on simple shapes first (cube), then complex (castle)

## Step 3: Test the Model

```python
# Quick test
from text_conditioned_policy import TextConditionedPolicy
from text_conditioned_env import TextConditioned3DEnv

policy = TextConditionedPolicy()
policy.load_state_dict(torch.load('trained_models/policy_text_conditioned.pt'))

env = TextConditioned3DEnv(num_agents=5)
obs = env.reset(text="pyramid", voxels=[...])  # Your LLM voxels

for step in range(100):
    actions = {}
    for i in range(5):
        action, _ = policy.act(obs[f'agent_{i}'], "pyramid")
        actions[f'agent_{i}'] = action
    
    obs, rewards, dones, _ = env.step(actions)
    
    if dones['__all__']:
        break

env.render()  # See the result!
```

## Key Features

### 1. Local Observations (Emergent Behavior!)
- Each agent sees only 3×3×3 around itself
- No agent knows the full structure
- Coordination emerges from scent-following

### 2. Scent Fields (Smart Guidance)
```python
# Distance to nearest target block
distance_map = distance_transform_edt(1 - target)
# Invert: high value AT targets
scent_field = 1.0 - (distance_map / max_dist)
```

Agents feel "I'm getting warmer!" toward targets.

### 3. Text Conditioning (Language Understanding)
```python
text_emb = sentence_transformer.encode("pyramid")  # [0.8, -0.2, ...]
combined = concat([vision_features, text_emb])
actions = policy(combined)
```

Same policy learns ALL shapes conditioned on text!

## Expected Results

| Episode | Behavior | Match Score |
|---------|----------|-------------|
| 0-50 | Random wandering | 0-5% |
| 50-150 | Following scent | 10-25% |
| 150-300 | Basic building | 30-50% |
| 300-500 | Good structures | 50-75% |
| 500+ | Expert level | 70-90% |

## Curriculum Learning

With `--curriculum` flag:
1. **Episodes 0-100**: Simple shapes (cubes, towers)
2. **Episodes 100-300**: Medium (pyramids, walls)
3. **Episodes 300+**: Complex (castles, bridges)

This dramatically improves convergence!

## Integration with Next.js

After training:
```bash
cp trained_models/policy_text_conditioned.onnx ../next-app/public/
```

In your app:
```typescript
import { RLAgent } from './lib/rl-agent';
import { voxelsToRLTarget } from './lib/rl-bridge';

// User input
const userText = "pyramid";

// Your LLM generates voxels
const voxels = await generateShapeFromText(userText);

// Convert to RL format
const { grid } = voxelsToRLTarget(voxels, 8);

// Load text-conditioned model
await rlSwarm.loadModel('/policy_text_conditioned.onnx');

// Agents build it (they understand "pyramid"!)
rlSwarm.setTarget(grid, textEmbedding=encodeText(userText));
```

## Advantages Over Non-Text RL

| Feature | Non-Text | Text-Conditioned |
|---------|----------|------------------|
| Training | 1 shape at a time | All shapes together |
| Generalization | None | New descriptions! |
| Demo Factor | "It learned one thing" | "It understands language!" |
| Deployment | Need many models | One model, infinite shapes |

## Troubleshooting

**Low match scores after 300 episodes?**
- Enable curriculum: `--curriculum`
- Increase scent field smoothing (edit `text_conditioned_env.py` line 95)
- Verify training data quality

**Agents not moving toward targets?**
- Check scent field generation (should show gradients)
- Increase gradient following reward (line 202)

**Out of memory?**
- Reduce agents: `--agents 3`
- Use CPU: `--device cpu`

## Time Budget

- Generate training pairs: 5 min
- Training: 45-60 min (GPU)
- Integration: 10 min
- **Total: ~1 hour**

This leaves 2.5 hours for UI polish and demo prep!

