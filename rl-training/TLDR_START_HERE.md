# 🚀 TL;DR - START TRAINING NOW

## The 3-Step Process

### 1️⃣ Generate Training Data (5 min)

```bash
cd rl-training

# Install dependencies
pip install torch sentence-transformers scipy numpy matplotlib

# Generate text-voxel pairs using YOUR LLM
python integrate_your_llm.py
```

**IMPORTANT:** Edit `integrate_your_llm.py` line 17-18 to point to your LLM code:
```python
from ai_shapes import generateShapeFromText  # ← Your actual import
```

This creates `data/training_pairs.json` with 30+ examples.

### 2️⃣ Train (45-60 min)

```bash
python train_text_conditioned.py \
  --episodes 600 \
  --agents 5 \
  --device cuda \
  --curriculum
```

Watch for:
- Episode 0-100: Learning to move (~10% match)
- Episode 100-300: Learning to build (~30-50%)
- Episode 300+: Expert building (~70-85%)

### 3️⃣ Deploy

```bash
cp trained_models/policy_text_conditioned.onnx ../next-app/public/
```

Done! Model is ready for browser inference.

---

## What You Get

**Text-Conditioned RL Agents** that:
- ✅ Understand language ("pyramid" vs "tower")
- ✅ Use LOCAL observations (3×3×3) not global grid
- ✅ Follow SCENT FIELDS (gradient toward targets)
- ✅ Scale to ANY grid size (learned emergent behavior)
- ✅ Work with YOUR existing LLM voxel generation

**Ground Truth:**
```
Text ("pyramid") 
  → YOUR LLM 
  → Voxels [{x,y,z}, ...]
  → RL Environment
  → Agents learn to build it!
```

---

## Architecture Highlights

### Local Observations (Emergent!)
```python
# OLD (global, doesn't scale):
obs = full_8x8x8_grid  # 512 features

# NEW (local, scales to any size):
obs = 3x3x3_patch + 3x3x3_scent  # 54 features
```

No agent sees the full structure → coordination emerges!

### Scent Fields (Smart guidance)
```python
# Distance to nearest target
scent_field = 1.0 - distance_transform(target)
```

Agents feel "warmer...warmer...HOT!" toward goals.

### Text Conditioning (Language!)
```python
text_emb = encode("pyramid")  # [0.8, -0.2, 0.1, ...]
policy(obs + text_emb) → actions
```

ONE policy learns ALL shapes!

---

## Troubleshooting

**"Cannot import ai_shapes"**
- Edit `integrate_your_llm.py` line 17
- Point to YOUR actual LLM file location

**Training too slow?**
- Use fewer episodes: `--episodes 300`
- Fewer agents: `--agents 3`

**Low performance after training?**
- Enable curriculum: `--curriculum` (trains simple→complex)
- Verify training data quality: `cat data/training_pairs.json`

**GPU not detected?**
```bash
python -c "import torch; print(torch.cuda.is_available())"
```

---

## Expected Timeline

| Task | Time | Output |
|------|------|--------|
| Generate data | 5 min | `training_pairs.json` |
| Training | 45-60 min | `policy_text_conditioned.onnx` |
| Integration | 10 min | Working in browser |
| **TOTAL** | **~1 hour** | Text-driven RL agents! |

---

## The Demo

User types: **"Build a castle"**

1. Your LLM generates voxels
2. RL agents see text embedding for "castle"
3. Agents autonomously build it using learned policy
4. No explicit instructions - pure emergence!

**Judge reaction:** *"Wait, the agents LEARNED to understand text?!"* 🔥

---

## Files You Need

- ✅ `integrate_your_llm.py` - Data generation (edit line 17!)
- ✅ `text_conditioned_env.py` - Environment with scent fields
- ✅ `text_conditioned_policy.py` - Vision + language network
- ✅ `train_text_conditioned.py` - Training loop
- 📖 `TEXT_TRAINING_GUIDE.md` - Detailed documentation

---

**Questions? Issues?** Everything is in `TEXT_TRAINING_GUIDE.md`

**Ready?** Run `python integrate_your_llm.py` NOW! 🚀

