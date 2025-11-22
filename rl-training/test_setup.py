"""
Quick test to verify RL setup before training
Run this first to catch issues early
"""
import sys

print("🧪 Testing RL Setup...")
print("=" * 50)

# Test 1: Import dependencies
print("\n1. Testing imports...")
try:
    import numpy as np
    print("   ✅ numpy")
except ImportError as e:
    print(f"   ❌ numpy: {e}")
    sys.exit(1)

try:
    import torch
    print("   ✅ torch")
    print(f"      Version: {torch.__version__}")
except ImportError as e:
    print(f"   ❌ torch: {e}")
    sys.exit(1)

# Test 2: GPU availability
print("\n2. Testing GPU...")
if torch.cuda.is_available():
    print(f"   ✅ GPU Available")
    print(f"      Name: {torch.cuda.get_device_name(0)}")
    print(f"      Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
else:
    print("   ⚠️  No GPU detected, will use CPU")
    print("      Training will be slower (~30-60 min instead of 15-25 min)")

# Test 3: Environment
print("\n3. Testing environment...")
try:
    from env import SwarmConstructionEnv
    env = SwarmConstructionEnv(num_agents=3, grid_size=8)
    obs = env.reset()
    print(f"   ✅ Environment created")
    print(f"      Agents: {env.num_agents}")
    print(f"      Grid size: {env.grid_size}")
    print(f"      Observation size: {len(obs['agent_0'])}")
except Exception as e:
    print(f"   ❌ Environment: {e}")
    sys.exit(1)

# Test 4: Policy network
print("\n4. Testing policy network...")
try:
    from train import SimplePolicy
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    policy = SimplePolicy().to(device)
    
    # Test forward pass
    dummy_obs = torch.randn(1, 131).to(device)
    output = policy(dummy_obs)
    
    print(f"   ✅ Policy network")
    print(f"      Device: {device}")
    print(f"      Parameters: {sum(p.numel() for p in policy.parameters())}")
except Exception as e:
    print(f"   ❌ Policy: {e}")
    sys.exit(1)

# Test 5: Quick episode
print("\n5. Testing episode execution...")
try:
    from train import train_episode
    
    optimizer = torch.optim.Adam(policy.parameters(), lr=0.001)
    reward, score = train_episode(env, policy, optimizer, device)
    
    print(f"   ✅ Episode completed")
    print(f"      Reward: {reward:.2f}")
    print(f"      Match score: {score:.2%}")
except Exception as e:
    print(f"   ❌ Episode: {e}")
    sys.exit(1)

# Test 6: Target diversity
print("\n6. Testing target diversity...")
try:
    env = SwarmConstructionEnv(num_agents=3, grid_size=8)
    targets = []
    for _ in range(10):
        env.reset()
        targets.append(env.target.copy())
    
    # Check if targets are different
    unique = len(set([t.tobytes() for t in targets]))
    print(f"   ✅ Target generation")
    print(f"      Unique targets in 10 resets: {unique}/10")
    if unique < 5:
        print("      ⚠️  Low diversity - targets might be too similar")
except Exception as e:
    print(f"   ❌ Targets: {e}")

# Summary
print("\n" + "=" * 50)
print("✅ Setup verified! Ready to train.")
print("\nStart training with:")
print("   ./train_gpu.sh")
print("or:")
print("   python train.py --episodes 500 --agents 5 --device cuda")
print()

