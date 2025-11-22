# 🚀 QUICK START - Train RL Now!

## Install Dependencies (30 seconds)

```bash
cd rl-training

# If you have conda:
conda install pytorch numpy matplotlib

# Or if you have pip:
pip install torch numpy matplotlib
```

## Validate Setup (30 seconds)

```bash
python validate_logic.py
```

**Expected output:**
```
✅ Observations are informative
✅ Actions affect environment  
✅ Reward function is correct
✅ Target diversity is good
✅ Policy network works
✅ Learning is possible
✅ No crashes

🎉 ALL CHECKS PASSED!
```

## Train (40-60 minutes on GPU)

```bash
python train.py --episodes 600 --agents 5 --device cuda
```

**Watch for:**
- Episode 0-100: Random (~0-5% match) 🤖
- Episode 100-300: Learning! (~10-30%) 🧠
- Episode 300-500: Building! (~40-70%) 🏗️
- Episode 500+: Expert! (~70-85%) 🎯

## Output

After training, you'll have:
```
trained_models/
├── policy.onnx  ← Copy this to next-app/public/
└── training_history.json
```

## Visualize Results

```bash
python visualize_training.py
# Opens: trained_models/training_curves.png
```

## Integration

```bash
# Copy model
cp trained_models/policy.onnx ../next-app/public/

# Add to your page.tsx:
# <Script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js" />
```

Then in your code:
```typescript
const rlSwarm = new RLSwarmController(rlAgents, 8);
await rlSwarm.loadModel('/policy.onnx');

// LLM generates voxels
const voxels = await generateShapeFromText('pyramid');
const { grid } = voxelsToRLTarget(voxels, 8);

// RL agents build it!
rlSwarm.target = grid;
await rlSwarm.update(dt);
```

## Troubleshooting

**GPU not detected?**
```bash
python -c "import torch; print(torch.cuda.is_available())"
# If False, training will use CPU (slower)
```

**Training too slow?**
```bash
# Reduce episodes
python train.py --episodes 300 --agents 3 --device cuda
```

**Want to see it learning?**
```bash
# Edit train.py line ~150, uncomment:
if episode % 20 == 0:
    env.render()
```

---

**Time budget:** ~45 min total (install 1 min + train 40 min + integrate 4 min)

