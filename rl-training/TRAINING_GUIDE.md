# RL Training Guide - Quick Start

## 🚀 Start Training (GPU)

```bash
cd rl-training
./train_gpu.sh
```

**Expected output:**
```
🚀 Starting RL Training on GPU
================================
GPU Available: True
GPU Name: [Your GPU]

Training with 5 agents for 500 episodes...
Expected time: 15-25 minutes on GPU

Episode 0/500 | Avg Reward: -0.85 | Match Score: 0.00%
Episode 10/500 | Avg Reward: -0.23 | Match Score: 5.43%
Episode 50/500 | Avg Reward: 1.47 | Match Score: 23.11%
Episode 100/500 | Avg Reward: 3.89 | Match Score: 45.67%
Episode 200/500 | Avg Reward: 6.12 | Match Score: 68.34%
🎉 New best score: 71.23%!
Episode 300/500 | Avg Reward: 7.45 | Match Score: 78.90%
...
```

## 📊 What's Being Learned

The agents are training on **9 different shape types**:
- Pyramids
- Walls (horizontal/vertical)
- Lines (straight/diagonal)
- Squares
- L-shapes
- T-shapes
- Plus signs
- Corner patterns
- Random sparse patterns

This teaches them to build **ANY pattern**, not just one shape.

## 🎯 Success Criteria

- **Episode 0-50**: Random behavior (match < 10%)
- **Episode 50-150**: Learning patterns (match 20-40%)
- **Episode 150-300**: Good performance (match 50-70%)
- **Episode 300+**: Expert level (match 70-90%)

## 📦 Output Files

After training, you'll get:

```
trained_models/
├── policy_best.pt          # PyTorch checkpoint
├── policy.onnx            # For browser (use this!)
├── weights.json           # Raw weights
└── training_history.json  # Learning curves
```

## 🌐 Integration with Next.js

### Step 1: Copy model to Next.js

```bash
cp trained_models/policy.onnx ../next-app/public/
```

### Step 2: Load in your page.tsx

```typescript
import { RLSwarmController, RLAgent } from '../lib/rl-agent';
import { voxelsToRLTarget } from '../lib/rl-bridge';
import { generateShapeFromText } from '../lib/ai_shapes';

// Create RL agents (150 bots, same brain)
const rlAgents = [];
for (let i = 0; i < 150; i++) {
  const mesh = createMicrobotMesh();
  rlAgents.push(new RLAgent(i, mesh, 8));
}

const rlSwarm = new RLSwarmController(rlAgents, 8);

// Load trained model
await rlSwarm.loadModel('/policy.onnx');

// When user enters command:
const voxels = await generateShapeFromText('pyramid 4');
const { grid } = voxelsToRLTarget(voxels, 8, 'occupancy');
rlSwarm.target = grid;

// In animation loop:
await rlSwarm.update(dt);
```

### Step 3: Add ONNX Runtime to page

```html
<!-- In app/layout.tsx or page.tsx -->
<Script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js" />
```

## 🐛 Debugging

### Training too slow?
```bash
# Reduce episodes
python train.py --episodes 200 --agents 3
```

### GPU not detected?
```bash
python -c "import torch; print(torch.cuda.is_available())"
```

### Watch live training
```bash
# Open train.py and uncomment line 150:
if episode % 20 == 0:
    env.render()  # Shows ASCII visualization
```

### Visualize results
```bash
pip install matplotlib
python visualize_training.py
# Opens: trained_models/training_curves.png
```

## 🎬 Demo Flow

1. **Rule-based (Stigmergy)**: "Here's the engineered approach"
2. **RL Mode**: "Watch agents learn from scratch"
3. **Show training curves**: "They improved from 0% to 80% accuracy"
4. **Live demo**: "Same LLM input, but RL agents execute"

## ⏱️ Timeline

- Setup: 5 min
- Training: 15-25 min (GPU)
- Integration: 10-15 min
- **Total**: ~40 minutes to working RL demo

## 🚨 Troubleshooting

**Error: "No module named torch"**
```bash
source venv/bin/activate
pip install torch
```

**Error: "CUDA out of memory"**
```bash
# Reduce batch size or use CPU
python train.py --device cpu
```

**Poor performance after training**
```bash
# Train longer or with more agents
python train.py --episodes 1000 --agents 8
```

