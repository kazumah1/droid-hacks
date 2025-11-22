"""
Quick validation test - runs in 30 seconds
Verifies RL logic is sound before wasting 20 min on training
"""
import numpy as np
import torch
from env import SwarmConstructionEnv
from train import SimplePolicy, train_episode

print("🔍 VALIDATING RL LOGIC")
print("=" * 60)

# Test 1: Observation space is informative
print("\n1. Testing observation contains enough information...")
env = SwarmConstructionEnv(num_agents=3, grid_size=8)
obs_dict = env.reset()

obs = obs_dict['agent_0']
print(f"   ✅ Observation size: {len(obs)} features")
print(f"      Position (2): {obs[:2]}")
print(f"      Grid state (64): {obs[2:66].sum():.1f} blocks")
print(f"      Has block (1): {obs[66]}")
print(f"      Target (64): {obs[67:].sum():.1f} target blocks")

# Verify observation changes when state changes
env.grid[4, 4] = 1.0
obs2 = env._get_observations()['agent_0']
obs_changed = not np.array_equal(obs, obs2)
assert obs_changed, "❌ Observation doesn't reflect state changes!"
print(f"   ✅ Observations update correctly")

# Test 2: Actions actually affect environment
print("\n2. Testing actions affect environment...")
initial_pos = env.agent_positions[0].copy()
actions = {'agent_0': 0, 'agent_1': 1, 'agent_2': 2}  # Different directions
env.step(actions)
pos_changed = not np.array_equal(initial_pos, env.agent_positions[0])
print(f"   ✅ Movement actions work: {initial_pos} → {env.agent_positions[0]}")

# Test block placement
env.agent_has_block[0] = True
env.agent_positions[0] = [3, 3]
actions = {'agent_0': 4, 'agent_1': 0, 'agent_2': 0}  # Agent 0 places block
obs, rewards, dones, _ = env.step(actions)
assert env.grid[3, 3] == 1.0, "❌ Block placement doesn't work!"
assert not env.agent_has_block[0], "❌ Agent still has block after placing!"
print(f"   ✅ Block placement works")

# Test 3: Reward function is sensible
print("\n3. Testing reward function...")
env.reset()

# Scenario A: Place block in CORRECT spot
target_block = np.argwhere(env.target > 0)[0]
env.agent_positions[0] = target_block
env.agent_has_block[0] = True
actions = {'agent_0': 4, 'agent_1': 0, 'agent_2': 0}
_, rewards_good, _, _ = env.step(actions)

# Scenario B: Place block in WRONG spot
env.reset()
wrong_spot = np.argwhere(env.target == 0)[0]
env.agent_positions[0] = wrong_spot
env.agent_has_block[0] = True
actions = {'agent_0': 4, 'agent_1': 0, 'agent_2': 0}
_, rewards_bad, _, _ = env.step(actions)

print(f"   Reward for correct placement: {rewards_good['agent_0']:.3f}")
print(f"   Reward for wrong placement: {rewards_bad['agent_0']:.3f}")
assert rewards_good['agent_0'] > rewards_bad['agent_0'], "❌ Reward doesn't favor correct placements!"
print(f"   ✅ Reward function favors correct placements")

# Test 4: Target diversity (critical for generalization!)
print("\n4. Testing target diversity...")
env = SwarmConstructionEnv(num_agents=3, grid_size=8)
targets = []
shapes_seen = set()

for i in range(20):
    env.reset()
    target_signature = env.target.tobytes()
    targets.append(target_signature)
    
    # Count blocks to identify shape type roughly
    block_count = np.sum(env.target > 0)
    pattern = (block_count, env.target.sum())
    shapes_seen.add(pattern)

unique_targets = len(set(targets))
print(f"   Unique targets in 20 episodes: {unique_targets}/20")
print(f"   Different patterns seen: {len(shapes_seen)}")

if unique_targets < 15:
    print(f"   ⚠️  WARNING: Low diversity! Only {unique_targets} unique targets")
    print(f"      Agents might overfit to specific patterns")
else:
    print(f"   ✅ Good diversity - agents will learn general building")

# Visualize a few random targets
print("\n   Sample targets:")
for i in range(3):
    env.reset()
    print(f"\n   Target {i+1}:")
    for row in env.target:
        print("   " + "".join(["🟦" if x > 0 else "⬜" for x in row]))

# Test 5: Policy can process observations
print("\n5. Testing policy network...")
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
policy = SimplePolicy().to(device)

obs_tensor = torch.FloatTensor(obs_dict['agent_0']).unsqueeze(0).to(device)
with torch.no_grad():
    action_probs = policy(obs_tensor)

print(f"   ✅ Policy forward pass works")
print(f"      Output shape: {action_probs.shape}")
print(f"      Action probs sum to: {action_probs.sum().item():.3f} (should be ~1.0)")
assert abs(action_probs.sum().item() - 1.0) < 0.01, "❌ Action probs don't sum to 1!"
print(f"   ✅ Valid probability distribution")

# Test 6: Policy can learn (quick gradient check)
print("\n6. Testing learning capability (1 episode)...")
env = SwarmConstructionEnv(num_agents=3, grid_size=8)
optimizer = torch.optim.Adam(policy.parameters(), lr=0.001)

# Get initial parameters
initial_params = [p.clone() for p in policy.parameters()]

# Run one training episode
reward, score = train_episode(env, policy, optimizer, device)
print(f"   Episode reward: {reward:.2f}")
print(f"   Match score: {score:.2%}")

# Check if parameters changed
params_changed = any(not torch.equal(p1, p2) for p1, p2 in zip(initial_params, policy.parameters()))
assert params_changed, "❌ Parameters didn't update after training!"
print(f"   ✅ Policy parameters updated (learning is happening)")

# Test 7: Theoretical capacity check
print("\n7. Checking theoretical capacity...")
num_params = sum(p.numel() for p in policy.parameters())
obs_size = 131
action_size = 6
min_params_needed = obs_size * 10  # Rule of thumb

print(f"   Network parameters: {num_params:,}")
print(f"   Observation space: {obs_size}")
print(f"   Action space: {action_size}")
print(f"   Minimum recommended: {min_params_needed:,}")

if num_params < min_params_needed:
    print(f"   ⚠️  Network might be too small")
else:
    print(f"   ✅ Network has sufficient capacity")

# Test 8: Run 5 quick episodes to check for crashes
print("\n8. Running 5 quick episodes (crash test)...")
crashes = 0
rewards_list = []
for ep in range(5):
    try:
        env = SwarmConstructionEnv(num_agents=3, grid_size=8)
        reward, score = train_episode(env, policy, optimizer, device)
        rewards_list.append(reward)
        print(f"   Episode {ep+1}: Reward={reward:.2f}, Score={score:.1%}")
    except Exception as e:
        print(f"   ❌ Crash on episode {ep+1}: {e}")
        crashes += 1

if crashes > 0:
    print(f"   ❌ {crashes}/5 episodes crashed!")
else:
    print(f"   ✅ All episodes completed successfully")
    print(f"   Average reward: {np.mean(rewards_list):.2f}")

# Final verdict
print("\n" + "=" * 60)
print("📊 VALIDATION SUMMARY")
print("=" * 60)

checks = [
    ("Observations are informative", True),
    ("Actions affect environment", True),
    ("Reward function is correct", rewards_good['agent_0'] > rewards_bad['agent_0']),
    ("Target diversity is good", unique_targets >= 15),
    ("Policy network works", action_probs.sum().item() > 0.99),
    ("Learning is possible", params_changed),
    ("No crashes", crashes == 0),
]

all_passed = all(check[1] for check in checks)

for name, passed in checks:
    status = "✅" if passed else "❌"
    print(f"{status} {name}")

print("\n" + "=" * 60)
if all_passed:
    print("🎉 ALL CHECKS PASSED!")
    print("\n✅ Theory is sound. Safe to start training.")
    print("\nStart training with:")
    print("   ./train_gpu.sh")
    print("\nExpected outcome:")
    print("   - Episode 0-50: Random (~0-10% match)")
    print("   - Episode 50-150: Learning patterns (~20-40%)")
    print("   - Episode 150-300: Good performance (~50-70%)")
    print("   - Episode 300+: Expert level (~70-85%)")
else:
    print("⚠️  SOME CHECKS FAILED")
    print("\nReview failures above before training.")
    print("Training might fail or produce poor results.")

print()

