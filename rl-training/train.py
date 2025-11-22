"""
Simple Policy Gradient training for swarm construction
Uses vanilla REINFORCE algorithm (simplest RL that works)
"""
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.distributions import Categorical
import json
from pathlib import Path
from env import SwarmConstructionEnv

class SimplePolicy(nn.Module):
    """
    3D policy network
    Input: observation vector (1028 features for 3D!)
    Output: action probabilities (8 actions: 6 movements + 2 block actions)
    """
    def __init__(self, obs_size=1028, hidden_size=128, action_size=8):
        super().__init__()
        # Larger network for 3D (more complex)
        self.network = nn.Sequential(
            nn.Linear(obs_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Linear(hidden_size // 2, action_size),
            nn.Softmax(dim=-1)
        )
    
    def forward(self, x):
        return self.network(x)
    
    def act(self, obs, device='cpu'):
        """Sample action from policy"""
        obs_tensor = torch.FloatTensor(obs).unsqueeze(0).to(device)
        probs = self.forward(obs_tensor)
        dist = Categorical(probs)
        action = dist.sample()
        log_prob = dist.log_prob(action)
        return action.item(), log_prob

def train_episode(env, policy, optimizer, device):
    """Run one episode and update policy"""
    obs_dict = env.reset()
    
    # Storage for trajectory
    trajectories = {f'agent_{i}': {'obs': [], 'actions': [], 'rewards': [], 'log_probs': []} 
                   for i in range(env.num_agents)}
    
    done = False
    episode_reward = 0
    
    while not done:
        actions = {}
        log_probs = {}
        
        # Each agent selects action
        for i in range(env.num_agents):
            agent_key = f'agent_{i}'
            obs = obs_dict[agent_key]
            action, log_prob = policy.act(obs, device)
            
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
    
    # Calculate returns and update policy
    policy_loss = []
    
    for i in range(env.num_agents):
        agent_key = f'agent_{i}'
        rewards = trajectories[agent_key]['rewards']
        log_probs = trajectories[agent_key]['log_probs']
        
        # Calculate discounted returns
        returns = []
        G = 0
        gamma = 0.99
        for r in reversed(rewards):
            G = r + gamma * G
            returns.insert(0, G)
        
        returns = torch.FloatTensor(returns).to(device)
        returns = (returns - returns.mean()) / (returns.std() + 1e-8)  # Normalize
        
        # Policy gradient loss
        for log_prob, G in zip(log_probs, returns):
            policy_loss.append(-log_prob * G)
    
    # Update
    optimizer.zero_grad()
    loss = torch.stack(policy_loss).sum()
    loss.backward()
    optimizer.step()
    
    return episode_reward / env.num_agents, infos['agent_0']['match_score']

def train(num_episodes=500, num_agents=5, save_path='./trained_models', device='cuda'):
    """Main training loop"""
    print("🤖 Starting RL Training for Swarm Construction")
    print("=" * 50)
    print(f"Config: {num_agents} agents, {num_episodes} episodes")
    print(f"Device: {device}")
    
    # Setup
    device = torch.device(device if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    env = SwarmConstructionEnv(num_agents=num_agents, grid_size=8)
    policy = SimplePolicy().to(device)
    optimizer = optim.Adam(policy.parameters(), lr=0.001)
    
    # Training loop
    best_score = 0
    episode_rewards = []
    match_scores = []
    
    for episode in range(num_episodes):
        reward, match_score = train_episode(env, policy, optimizer, device)
        episode_rewards.append(reward)
        match_scores.append(match_score)
        
        # Logging
        if episode % 10 == 0:
            avg_reward = np.mean(episode_rewards[-10:])
            avg_score = np.mean(match_scores[-10:])
            print(f"Episode {episode}/{num_episodes} | "
                  f"Avg Reward: {avg_reward:.2f} | "
                  f"Match Score: {avg_score:.2%}")
        
        # Save best model
        if match_score > best_score:
            best_score = match_score
            save_model(policy, save_path, match_score)
            if match_score > 0.7:
                print(f"🎉 New best score: {match_score:.2%}!")
    
    print("\n✅ Training Complete!")
    print(f"Best Match Score: {best_score:.2%}")
    
    # Save training history
    Path(save_path).mkdir(exist_ok=True)
    history = {
        'rewards': episode_rewards,
        'match_scores': match_scores
    }
    with open(f"{save_path}/training_history.json", 'w') as f:
        json.dump(history, f)
    
    return policy, episode_rewards, match_scores

def save_model(policy, save_path, score):
    """Save model weights in multiple formats"""
    Path(save_path).mkdir(exist_ok=True)
    
    # PyTorch format
    torch.save(policy.state_dict(), f"{save_path}/policy_best.pt")
    
    # Export weights as JSON for JavaScript
    weights = {}
    for name, param in policy.named_parameters():
        weights[name] = param.detach().cpu().numpy().tolist()
    
    with open(f"{save_path}/weights.json", 'w') as f:
        json.dump(weights, f)
    
    # ONNX format for browser inference
    dummy_input = torch.randn(1, 131)
    torch.onnx.export(
        policy,
        dummy_input,
        f"{save_path}/policy.onnx",
        export_params=True,
        opset_version=10,
        input_names=['observation'],
        output_names=['action_probs'],
        dynamic_axes={'observation': {0: 'batch_size'}}
    )
    
    print(f"💾 Model saved (score: {score:.2%})")

def test_policy(policy, env, num_episodes=5):
    """Test trained policy"""
    print("\n🧪 Testing Policy...")
    
    for ep in range(num_episodes):
        obs_dict = env.reset()
        done = False
        total_reward = 0
        
        while not done:
            actions = {}
            for i in range(env.num_agents):
                agent_key = f'agent_{i}'
                obs = obs_dict[agent_key]
                action, _ = policy.act(obs)
                actions[agent_key] = action
            
            obs_dict, rewards, dones, infos = env.step(actions)
            total_reward += sum(rewards.values())
            done = dones['__all__']
        
        match_score = infos['agent_0']['match_score']
        print(f"Episode {ep+1}: Reward={total_reward:.2f}, Match={match_score:.2%}")
        
        if ep == 0:
            env.render()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--episodes', type=int, default=500, help='Number of training episodes')
    parser.add_argument('--agents', type=int, default=5, help='Number of agents')
    parser.add_argument('--device', type=str, default='cuda', help='cuda or cpu')
    args = parser.parse_args()
    
    # Train
    policy, rewards, scores = train(
        num_episodes=args.episodes,
        num_agents=args.agents,
        device=args.device
    )
    
    # Test
    env = SwarmConstructionEnv(num_agents=args.agents, grid_size=8)
    test_policy(policy, env)

