"""
Training script for text-conditioned RL agents
Agents learn to build structures from text descriptions
"""
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import json
import argparse
from pathlib import Path

from text_conditioned_env import TextConditioned3DEnv
from text_conditioned_policy import TextConditionedPolicy

def load_training_data(filepath="data/training_pairs.json"):
    """Load text-voxel pairs"""
    with open(filepath, 'r') as f:
        pairs = json.load(f)
    print(f"✅ Loaded {len(pairs)} training pairs")
    return pairs

def train_episode(env, policy, optimizer, text, voxels, device):
    """Train on one text-voxel pair"""
    obs_dict = env.reset(text=text, voxels=voxels)
    
    # Get text embedding once (shared by all agents)
    text_emb = policy.encode_text(text).to(device)
    
    # Storage
    trajectories = {
        f'agent_{i}': {
            'obs': [],
            'actions': [],
            'rewards': [],
            'log_probs': []
        } for i in range(env.num_agents)
    }
    
    done = False
    episode_reward = 0
    
    while not done:
        actions = {}
        log_probs = {}
        
        # Each agent acts
        for i in range(env.num_agents):
            agent_key = f'agent_{i}'
            obs = obs_dict[agent_key]
            
            obs_tensor = torch.FloatTensor(obs).unsqueeze(0).to(device)
            text_emb_batch = text_emb.unsqueeze(0)
            
            action, log_prob = policy.act(obs_tensor, text, device)
            
            trajectories[agent_key]['obs'].append(obs)
            trajectories[agent_key]['actions'].append(action)
            trajectories[agent_key]['log_probs'].append(log_prob)
            
            actions[agent_key] = action
        
        # Step environment
        obs_dict, rewards, dones, infos = env.step(actions)
        
        # Store rewards
        for i in range(env.num_agents):
            agent_key = f'agent_{i}'
            trajectories[agent_key]['rewards'].append(rewards[agent_key])
            episode_reward += rewards[agent_key]
        
        done = dones['__all__']
    
    # Calculate returns and update
    policy_loss = []
    
    for i in range(env.num_agents):
        agent_key = f'agent_{i}'
        rewards = trajectories[agent_key]['rewards']
        log_probs = trajectories[agent_key]['log_probs']
        
        # Discounted returns
        returns = []
        G = 0
        gamma = 0.99
        for r in reversed(rewards):
            G = r + gamma * G
            returns.insert(0, G)
        
        returns = torch.FloatTensor(returns).to(device)
        returns = (returns - returns.mean()) / (returns.std() + 1e-8)
        
        # Policy gradient
        for log_prob, G in zip(log_probs, returns):
            policy_loss.append(-log_prob * G)
    
    # Update
    optimizer.zero_grad()
    loss = torch.stack(policy_loss).sum()
    loss.backward()
    torch.nn.utils.clip_grad_norm_(policy.parameters(), 0.5)
    optimizer.step()
    
    return episode_reward / env.num_agents, infos['agent_0']['match_score']

def train(args):
    """Main training loop"""
    print("🤖 Training Text-Conditioned RL Agents")
    print("=" * 60)
    
    # Setup
    device = torch.device(args.device if torch.cuda.is_available() else 'cpu')
    print(f"Device: {device}")
    
    # Load training data
    training_pairs = load_training_data(args.data_file)
    
    # Initialize
    env = TextConditioned3DEnv(num_agents=args.agents, grid_size=8, local_obs_size=3)
    policy = TextConditionedPolicy().to(device)
    optimizer = optim.Adam(policy.parameters(), lr=args.lr)
    
    # Curriculum: Start with simpler examples
    if args.curriculum:
        # Sort by voxel count (simpler = fewer voxels)
        training_pairs = sorted(training_pairs, key=lambda x: x['voxel_count'])
        print("📚 Using curriculum learning (simple → complex)")
    
    # Training loop
    best_score = 0
    episode_rewards = []
    match_scores = []
    
    for episode in range(args.episodes):
        # Sample training pair (with curriculum)
        if args.curriculum and episode < 500:
            # VERY slow curriculum: master basics first
            # Episodes 0-200: only easiest 20%
            # Episodes 200-500: gradually add more
            if episode < 200:
                max_idx = max(1, len(training_pairs) // 5)  # Only easiest 20%
            else:
                progress = (episode - 200) / 300.0  # 0.0 to 1.0 over eps 200-500
                max_idx = int(len(training_pairs) // 5 + progress * (len(training_pairs) * 4 // 5))
            idx = np.random.randint(0, max(1, max_idx))
        else:
            # Later episodes: random sampling from all
            idx = np.random.randint(0, len(training_pairs))
        
        pair = training_pairs[idx]
        text = pair['text']
        voxels = pair['voxels']
        
        # Train episode
        reward, match_score = train_episode(env, policy, optimizer, text, voxels, device)
        episode_rewards.append(reward)
        match_scores.append(match_score)
        
        # Logging
        if episode % 10 == 0:
            avg_reward = np.mean(episode_rewards[-10:])
            avg_score = np.mean(match_scores[-10:])
            print(f"Episode {episode}/{args.episodes} | "
                  f"Text: '{text}' | "
                  f"Reward: {avg_reward:.2f} | "
                  f"Match: {avg_score:.1%}")
        
        # Save best
        if match_score > best_score:
            best_score = match_score
            save_model(policy, args.save_path, match_score, device)
            if match_score > 0.7:
                print(f"   🎉 New best: {match_score:.1%}!")
    
    print(f"\n✅ Training complete! Best score: {best_score:.1%}")
    
    # Save history
    history = {
        'rewards': episode_rewards,
        'match_scores': match_scores,
        'training_pairs': [p['text'] for p in training_pairs]
    }
    with open(f"{args.save_path}/training_history.json", 'w') as f:
        json.dump(history, f)
    
    return policy

def save_model(policy, save_path, score, device='cpu'):
    """Save model (temporarily moves to CPU for ONNX export)"""
    Path(save_path).mkdir(exist_ok=True)
    
    # PyTorch
    torch.save(policy.state_dict(), f"{save_path}/policy_text_conditioned.pt")
    
    # ONNX (for browser) - move to CPU for export
    policy.cpu()
    dummy_obs = torch.randn(1, 58)  # Local observations
    dummy_text = torch.randn(1, 384)
    
    torch.onnx.export(
        policy,
        (dummy_obs, dummy_text),
        f"{save_path}/policy_text_conditioned.onnx",
        export_params=True,
        opset_version=11,
        input_names=['observation', 'text_embedding'],
        output_names=['action_probs'],
        dynamic_axes={
            'observation': {0: 'batch_size'},
            'text_embedding': {0: 'batch_size'}
        }
    )
    
    # Move back to device for continued training
    policy.to(device)
    
    print(f"💾 Saved model (score: {score:.1%})")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--episodes', type=int, default=600, help='Training episodes')
    parser.add_argument('--agents', type=int, default=10, help='Number of agents')
    parser.add_argument('--device', type=str, default='cuda', help='cuda or cpu')
    parser.add_argument('--lr', type=float, default=0.0003, help='Learning rate')
    parser.add_argument('--curriculum', action='store_true', help='Use curriculum learning')
    parser.add_argument('--data_file', type=str, default='data/training_pairs.json')
    parser.add_argument('--save_path', type=str, default='trained_models')
    args = parser.parse_args()
    
    policy = train(args)

