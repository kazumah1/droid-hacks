"""
Visualize training progress
Run after training to see learning curves
"""
import json
import matplotlib.pyplot as plt
import numpy as np

def plot_training_history(history_path='./trained_models/training_history.json'):
    """Plot reward and match score curves"""
    with open(history_path, 'r') as f:
        history = json.load(f)
    
    rewards = history['rewards']
    scores = history['match_scores']
    
    # Smooth curves with moving average
    def smooth(data, window=10):
        return np.convolve(data, np.ones(window)/window, mode='valid')
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
    
    # Rewards
    ax1.plot(rewards, alpha=0.3, label='Raw')
    ax1.plot(smooth(rewards), label='Smoothed (10 ep)', linewidth=2)
    ax1.set_xlabel('Episode')
    ax1.set_ylabel('Average Reward')
    ax1.set_title('Training Reward Over Time')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # Match scores
    ax2.plot(scores, alpha=0.3, label='Raw')
    ax2.plot(smooth(scores), label='Smoothed (10 ep)', linewidth=2)
    ax2.set_xlabel('Episode')
    ax2.set_ylabel('Match Score (%)')
    ax2.set_title('Construction Accuracy Over Time')
    ax2.axhline(y=0.7, color='r', linestyle='--', label='70% threshold')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('./trained_models/training_curves.png', dpi=150)
    print("📊 Saved training curves to: ./trained_models/training_curves.png")
    
    # Print stats
    print("\n📈 Training Statistics:")
    print(f"   Episodes: {len(rewards)}")
    print(f"   Final Reward (avg last 50): {np.mean(rewards[-50:]):.2f}")
    print(f"   Final Match Score (avg last 50): {np.mean(scores[-50:]):.2%}")
    print(f"   Best Match Score: {max(scores):.2%}")
    print(f"   Reached 70% at episode: {next((i for i, s in enumerate(scores) if s > 0.7), 'Never')}")

if __name__ == "__main__":
    plot_training_history()

