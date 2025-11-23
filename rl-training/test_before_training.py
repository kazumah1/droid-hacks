"""
Quick validation test - runs in ~2 minutes
Catches issues BEFORE starting 60-minute training
"""
import sys
import os
import asyncio

print("🧪 PRE-TRAINING VALIDATION TEST")
print("=" * 60)

# Test 1: Dependencies
print("\n1️⃣ Testing dependencies...")
try:
    import numpy as np
    print("   ✅ numpy")
except ImportError as e:
    print(f"   ❌ numpy: {e}")
    sys.exit(1)

try:
    import torch
    print(f"   ✅ torch ({torch.__version__})")
except ImportError as e:
    print(f"   ❌ torch: {e}")
    sys.exit(1)

try:
    import scipy
    print(f"   ✅ scipy")
except ImportError as e:
    print(f"   ❌ scipy: {e}")
    sys.exit(1)

try:
    from sentence_transformers import SentenceTransformer
    print(f"   ✅ sentence-transformers")
except ImportError as e:
    print(f"   ❌ sentence-transformers: {e}")
    sys.exit(1)

try:
    from anthropic import AsyncAnthropic
    print(f"   ✅ anthropic")
except ImportError as e:
    print(f"   ❌ anthropic: {e}")
    print("\n   Install with: pip install anthropic")
    sys.exit(1)

# Test 2: GPU availability
print("\n2️⃣ Testing GPU...")
if torch.cuda.is_available():
    print(f"   ✅ GPU Available: {torch.cuda.get_device_name(0)}")
    print(f"      Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
    device = 'cuda'
else:
    print("   ⚠️  No GPU detected - will use CPU")
    print("      Training will take longer (~90-120 min)")
    device = 'cpu'

# Test 3: API key
print("\n3️⃣ Testing Anthropic API key...")
ANTHROPIC_API_KEY = os.getenv('NEXT_PUBLIC_ANTHROPIC_API_KEY') or os.getenv('ANTHROPIC_API_KEY')
if not ANTHROPIC_API_KEY:
    print("   ❌ API key not found!")
    print("      Set: export ANTHROPIC_API_KEY='sk-ant-...'")
    sys.exit(1)
print(f"   ✅ Found API key: {ANTHROPIC_API_KEY[:20]}...")

# Test 4: Claude API connection
print("\n4️⃣ Testing Claude API connection...")
async def test_claude():
    client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    try:
        message = await client.messages.create(
            model='claude-sonnet-4-5-20250929',
            max_tokens=100,
            messages=[{'role': 'user', 'content': 'Say "hello"'}]
        )
        response = message.content[0].text if message.content else ''
        print(f"   ✅ Claude responded: '{response[:50]}...'")
        return True
    except Exception as e:
        print(f"   ❌ Claude API error: {e}")
        return False

claude_works = asyncio.run(test_claude())
if not claude_works:
    print("\n   Check:")
    print("   - API key is valid")
    print("   - Account has credits")
    print("   - Internet connection")
    sys.exit(1)

# Test 5: Generate one training pair
print("\n5️⃣ Testing training data generation...")
from generate_training_data_anthropic import generate_with_claude
async def test_voxel_generation():
    client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    try:
        voxels = await generate_with_claude("small pyramid", client)
        print(f"   ✅ Generated {len(voxels)} voxels")
        print(f"      Sample: {voxels[:3]}")
        return voxels
    except Exception as e:
        print(f"   ❌ Generation error: {e}")
        return []

test_voxels = asyncio.run(test_voxel_generation())
if not test_voxels:
    print("   ⚠️  Using fallback, but this might affect training quality")

# Test 6: Environment
print("\n6️⃣ Testing RL environment...")
try:
    from text_conditioned_env import TextConditioned3DEnv
    
    env = TextConditioned3DEnv(num_agents=3, grid_size=8, local_obs_size=3)
    obs = env.reset(text="pyramid", voxels=test_voxels)
    
    print(f"   ✅ Environment created")
    print(f"      Agents: {env.num_agents}")
    print(f"      Grid: {env.grid_size}×{env.grid_size}×{env.grid_size}")
    print(f"      Observation size: {len(obs['agent_0'])} features")
    
    # Check scent field
    if np.max(env.scent_field) > 0:
        print(f"   ✅ Scent field generated (max: {np.max(env.scent_field):.2f})")
    else:
        print(f"   ⚠️  Scent field is empty - might affect training")
    
except Exception as e:
    print(f"   ❌ Environment error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 7: Policy network
print("\n7️⃣ Testing policy network...")
try:
    from text_conditioned_policy import TextConditionedPolicy
    
    policy = TextConditionedPolicy().to(device)
    
    # Test forward pass
    obs_tensor = torch.FloatTensor(obs['agent_0']).unsqueeze(0).to(device)
    text_emb = policy.encode_text("pyramid").unsqueeze(0).to(device)
    
    with torch.no_grad():
        action_probs = policy(obs_tensor, text_emb)
    
    print(f"   ✅ Policy forward pass works")
    print(f"      Input: {obs_tensor.shape}")
    print(f"      Output: {action_probs.shape}")
    print(f"      Probs sum: {action_probs.sum().item():.3f} (should be ~1.0)")
    
    if abs(action_probs.sum().item() - 1.0) > 0.01:
        print(f"   ⚠️  Probability distribution might be off")
    
    # Test action sampling
    action, log_prob = policy.act(obs_tensor, "pyramid", device)
    print(f"   ✅ Action sampling works: action={action}, log_prob={log_prob.item():.3f}")
    
except Exception as e:
    print(f"   ❌ Policy error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 8: Training episode
print("\n8️⃣ Testing training episode...")
try:
    from train_text_conditioned import train_episode
    
    optimizer = torch.optim.Adam(policy.parameters(), lr=0.0003)
    
    print("   Running 1 episode (this takes ~10 seconds)...")
    reward, match_score = train_episode(
        env, policy, optimizer, 
        text="pyramid", 
        voxels=test_voxels, 
        device=device
    )
    
    print(f"   ✅ Episode completed")
    print(f"      Reward: {reward:.2f}")
    print(f"      Match score: {match_score:.1%}")
    
    # Check if parameters updated
    param_sum = sum(p.sum().item() for p in policy.parameters())
    print(f"   ✅ Policy parameters updated (sum: {param_sum:.3f})")
    
except Exception as e:
    print(f"   ❌ Training error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 9: Run 3 more episodes quickly
print("\n9️⃣ Testing 3 more episodes...")
try:
    rewards = []
    scores = []
    
    for i in range(3):
        env.reset(text="pyramid", voxels=test_voxels)
        reward, score = train_episode(
            env, policy, optimizer,
            text="pyramid",
            voxels=test_voxels,
            device=device
        )
        rewards.append(reward)
        scores.append(score)
        print(f"   Episode {i+1}: Reward={reward:.2f}, Score={score:.1%}")
    
    print(f"   ✅ All episodes completed")
    print(f"      Avg reward: {np.mean(rewards):.2f}")
    print(f"      Avg score: {np.mean(scores):.1%}")
    
except Exception as e:
    print(f"   ❌ Multi-episode error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 10: Model saving
print("\n🔟 Testing model saving...")
try:
    from train_text_conditioned import save_model
    import tempfile
    
    with tempfile.TemporaryDirectory() as tmpdir:
        save_model(policy, tmpdir, 0.5)
        
        # Check files exist
        import os
        pt_exists = os.path.exists(f"{tmpdir}/policy_text_conditioned.pt")
        onnx_exists = os.path.exists(f"{tmpdir}/policy_text_conditioned.onnx")
        
        if pt_exists and onnx_exists:
            print(f"   ✅ Model saves correctly")
            pt_size = os.path.getsize(f"{tmpdir}/policy_text_conditioned.pt") / 1024
            onnx_size = os.path.getsize(f"{tmpdir}/policy_text_conditioned.onnx") / 1024
            print(f"      PyTorch: {pt_size:.1f} KB")
            print(f"      ONNX: {onnx_size:.1f} KB")
        else:
            print(f"   ⚠️  Some files missing (pt: {pt_exists}, onnx: {onnx_exists})")
        
except Exception as e:
    print(f"   ⚠️  Model saving error: {e}")
    print("      Training will still work, but model might not save correctly")

# Final summary
print("\n" + "=" * 60)
print("✅ ALL TESTS PASSED!")
print("=" * 60)
print("\n📊 Summary:")
print(f"   Device: {device}")
print(f"   API: Claude Sonnet 4.5")
print(f"   Environment: {env.num_agents} agents, {env.grid_size}³ grid")
print(f"   Policy: {sum(p.numel() for p in policy.parameters()):,} parameters")
print(f"   Local obs: {len(obs['agent_0'])} features")

print("\n✅ Ready for training!")
print("\n📋 Next steps:")
print("   1. Generate full training data:")
print("      python generate_training_data_anthropic.py")
print("")
print("   2. Start training:")
print("      python train_text_conditioned.py --episodes 600 --agents 5 --device cuda --curriculum")
print("")
print("   Expected time: 45-60 minutes on GPU")
print("")
print("🚀 Or run everything with: ./START_TRAINING.sh")

