# RL Training for Swarm Construction

## Quick Start

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Train the agents (20-30 minutes)
python train.py
```

## What This Does

- **Agents**: 3 robots learning to build a pyramid
- **Learning**: Policy Gradient (REINFORCE algorithm)
- **Training Time**: ~20-30 min on CPU, ~5 min on GPU
- **Output**: 
  - `trained_models/policy.onnx` - For browser inference
  - `trained_models/weights.json` - Neural network weights
  - `trained_models/training_history.json` - Learning curves

## Architecture

```
Agent Observation (131 features):
├── Position (2): x, y normalized
├── Grid State (64): 8x8 flattened
├── Has Block (1): boolean
└── Target Structure (64): goal pattern

↓ Neural Network (2 hidden layers, 64 units each)

Action (6 options):
├── 0: Move Up
├── 1: Move Right  
├── 2: Move Down
├── 3: Move Left
├── 4: Place Block
└── 5: Pickup Block (unused for now)
```

## Reward Function

```python
reward = (correct_blocks / total_target) * 10 - wrong_blocks * 0.5 - 0.01
```

- Collaborative: All agents share reward
- Sparse: Big reward when structure matches
- Penalty: For placing blocks in wrong spots

## Integration with Three.js

The trained model exports to ONNX format. Use `onnxruntime-web` in your Next.js app:

```typescript
import * as ort from 'onnxruntime-web';

const session = await ort.InferenceSession.create('./policy.onnx');
const results = await session.run({
  observation: new ort.Tensor('float32', obs, [1, 131])
});
```

## Expected Results

- Episode 0-50: Random movement
- Episode 50-150: Agents learn to move toward center
- Episode 150-300: Agents learn to place blocks correctly
- Final Match Score: 70-90%

## Debugging

Watch training live:
```python
# Add to train.py
if episode % 50 == 0:
    env.render()
```

