"""
Minimal RL Environment for Swarm Construction
Simple grid world where agents learn to build structures
"""
import numpy as np
from typing import Tuple, Dict, List

class SwarmConstructionEnv:
    """
    3D construction environment for RL training
    - 8×8×8 voxel grid (TRUE 3D!)
    - 3-5 agents
    - Agents can: move in 6 directions + place/pickup blocks
    - Goal: Match target 3D structure
    """
    
    def __init__(self, num_agents=3, grid_size=8):
        self.num_agents = num_agents
        self.grid_size = grid_size
        self.max_steps = 150  # More steps for 3D
        
        # State (3D!)
        self.grid = np.zeros((grid_size, grid_size, grid_size), dtype=np.float32)
        self.agent_positions = np.zeros((num_agents, 3), dtype=np.int32)  # x, y, z
        self.agent_has_block = np.zeros(num_agents, dtype=bool)
        
        # Target structure (randomized for generalization)
        self.target = self._make_random_target()
        
        self.step_count = 0
        self.reset()
    
    def _make_random_target(self) -> np.ndarray:
        """
        Generate diverse 3D training targets
        Agents learn to build ANY 3D structure
        """
        target = np.zeros((self.grid_size, self.grid_size, self.grid_size), dtype=np.float32)
        
        # Randomly select 3D shape type
        shape_type = np.random.choice([
            'pyramid', 'tower', 'wall_3d', 'cube', 'staircase',
            'bridge', 'arch', 'platform', 'random_3d'
        ])
        
        center = self.grid_size // 2
        
        if shape_type == 'pyramid':
            # True 3D pyramid (decreasing layers)
            max_height = 4
            for y in range(max_height):
                size = max_height - y
                offset = (self.grid_size - size) // 2
                target[offset:offset+size, y, offset:offset+size] = 1.0
            
        elif shape_type == 'tower':
            # Vertical tower
            height = np.random.randint(3, 6)
            x = np.random.randint(2, self.grid_size - 2)
            z = np.random.randint(2, self.grid_size - 2)
            target[x, :height, z] = 1.0
            
        elif shape_type == 'wall_3d':
            # 3D wall with height
            height = np.random.randint(2, 5)
            if np.random.rand() > 0.5:
                x = np.random.randint(2, self.grid_size - 2)
                target[x, :height, :] = 1.0
            else:
                z = np.random.randint(2, self.grid_size - 2)
                target[:, :height, z] = 1.0
                
        elif shape_type == 'cube':
            # Solid cube
            size = np.random.randint(2, 4)
            x = np.random.randint(1, self.grid_size - size - 1)
            z = np.random.randint(1, self.grid_size - size - 1)
            target[x:x+size, :size, z:z+size] = 1.0
            
        elif shape_type == 'staircase':
            # Ascending staircase
            for i in range(min(5, self.grid_size-2)):
                target[i+1, i, center] = 1.0
                
        elif shape_type == 'bridge':
            # Bridge structure (two pillars + platform)
            height = 3
            # Left pillar
            target[2, :height, center] = 1.0
            # Right pillar
            target[6, :height, center] = 1.0
            # Top platform
            target[2:7, height-1, center] = 1.0
            
        elif shape_type == 'arch':
            # Simple arch
            # Left support
            target[2, :3, center] = 1.0
            # Right support
            target[5, :3, center] = 1.0
            # Top
            target[2:6, 2, center] = 1.0
            
        elif shape_type == 'platform':
            # Raised platform
            height = np.random.randint(1, 4)
            size = np.random.randint(3, 5)
            offset = (self.grid_size - size) // 2
            target[offset:offset+size, height, offset:offset+size] = 1.0
            
        elif shape_type == 'random_3d':
            # Random 3D sparse structure (5-15 blocks)
            num_blocks = np.random.randint(5, 16)
            for _ in range(num_blocks):
                x = np.random.randint(1, self.grid_size - 1)
                y = np.random.randint(0, min(4, self.grid_size - 1))
                z = np.random.randint(1, self.grid_size - 1)
                target[x, y, z] = 1.0
        
        return target
    
    def reset(self) -> Dict[str, np.ndarray]:
        """Reset environment to initial state"""
        self.grid = np.zeros((self.grid_size, self.grid_size), dtype=np.float32)
        self.step_count = 0
        
        # Spawn agents randomly at ground level edges
        for i in range(self.num_agents):
            edge = np.random.randint(0, 4)  # 0=top, 1=right, 2=bottom, 3=left
            if edge == 0:
                self.agent_positions[i] = [0, 0, np.random.randint(0, self.grid_size)]
            elif edge == 1:
                self.agent_positions[i] = [np.random.randint(0, self.grid_size), 0, self.grid_size-1]
            elif edge == 2:
                self.agent_positions[i] = [self.grid_size-1, 0, np.random.randint(0, self.grid_size)]
            else:
                self.agent_positions[i] = [np.random.randint(0, self.grid_size), 0, 0]
        
        # Start with blocks
        self.agent_has_block = np.ones(self.num_agents, dtype=bool)
        
        # Randomize target each episode
        self.target = self._make_random_target()
        
        return self._get_observations()
    
    def _get_observations(self) -> Dict[str, np.ndarray]:
        """
        Get observations for all agents (3D version)
        Each agent sees:
        - Its own position (3): x, y, z
        - Grid state (flattened 8×8×8 = 512)
        - Has block (1)
        - Target structure (flattened 8×8×8 = 512)
        Total: 1028 features per agent (much larger for 3D!)
        """
        obs = {}
        for i in range(self.num_agents):
            agent_obs = np.concatenate([
                self.agent_positions[i] / self.grid_size,  # Normalized position (3)
                self.grid.flatten(),  # Current state (512)
                [float(self.agent_has_block[i])],  # Has block (1)
                self.target.flatten(),  # Target (512)
            ], dtype=np.float32)
            obs[f'agent_{i}'] = agent_obs
        
        return obs
    
    def step(self, actions: Dict[str, int]) -> Tuple[Dict, Dict, Dict, Dict]:
        """
        Execute actions for all agents (3D version)
        Actions: 0=forward, 1=right, 2=backward, 3=left, 4=up, 5=down, 6=place_block, 7=pickup_block
        """
        self.step_count += 1
        
        # Execute each agent's action
        for i in range(self.num_agents):
            action = actions[f'agent_{i}']
            pos = self.agent_positions[i]
            
            # Movement in X axis (forward/backward)
            if action == 0 and pos[0] > 0:  # Forward (-X)
                self.agent_positions[i][0] -= 1
            elif action == 2 and pos[0] < self.grid_size - 1:  # Backward (+X)
                self.agent_positions[i][0] += 1
            
            # Movement in Z axis (right/left)
            elif action == 1 and pos[2] < self.grid_size - 1:  # Right (+Z)
                self.agent_positions[i][2] += 1
            elif action == 3 and pos[2] > 0:  # Left (-Z)
                self.agent_positions[i][2] -= 1
            
            # Movement in Y axis (up/down) - NEW FOR 3D!
            elif action == 4 and pos[1] < self.grid_size - 1:  # Up (+Y)
                # Can only move up if there's a block below or already at ground
                if pos[1] == 0 or self.grid[pos[0], pos[1]-1, pos[2]] > 0:
                    self.agent_positions[i][1] += 1
            elif action == 5 and pos[1] > 0:  # Down (-Y)
                self.agent_positions[i][1] -= 1
            
            # Block actions
            elif action == 6:  # Place block
                if self.agent_has_block[i]:
                    self.grid[pos[0], pos[1], pos[2]] = 1.0
                    self.agent_has_block[i] = False
            elif action == 7:  # Pickup block  
                if not self.agent_has_block[i] and self.grid[pos[0], pos[1], pos[2]] == 0:
                    self.agent_has_block[i] = True
        
        # Calculate reward
        rewards = self._calculate_rewards()
        
        # Check if done
        done = self.step_count >= self.max_steps
        match_score = np.sum((self.grid > 0) & (self.target > 0)) / np.sum(self.target > 0)
        done = done or match_score > 0.8
        
        dones = {f'agent_{i}': done for i in range(self.num_agents)}
        dones['__all__'] = done
        
        obs = self._get_observations()
        infos = {f'agent_{i}': {'match_score': match_score} for i in range(self.num_agents)}
        
        return obs, rewards, dones, infos
    
    def _calculate_rewards(self) -> Dict[str, float]:
        """
        Calculate rewards for all agents
        Collaborative reward: everyone shares success
        """
        # How many target cells are filled?
        correct_placements = np.sum((self.grid > 0) & (self.target > 0))
        total_target = np.sum(self.target > 0)
        
        # How many wrong placements?
        wrong_placements = np.sum((self.grid > 0) & (self.target == 0))
        
        # Shared reward
        base_reward = (correct_placements / total_target) * 10.0 - wrong_placements * 0.5
        
        # Small penalty for time (encourage speed)
        time_penalty = -0.01
        
        reward = base_reward + time_penalty
        
        # All agents get same reward (cooperative)
        return {f'agent_{i}': reward for i in range(self.num_agents)}
    
    def render(self):
        """Simple text rendering for 3D (layer by layer)"""
        print("\n" + "="*30)
        print(f"Step: {self.step_count}")
        
        # Show each Y layer
        print("\nCurrent State (layer by layer, Y=0 to top):")
        for y in range(min(4, self.grid_size)):  # Show first 4 layers
            print(f"\n  Layer Y={y}:")
            layer = self.grid[:, y, :].copy()
            
            # Mark agents on this layer
            for i, pos in enumerate(self.agent_positions):
                if pos[1] == y:
                    layer[pos[0], pos[2]] = 9
            
            for row in layer:
                print("  " + "".join(["🤖" if x == 9 else "🟦" if x > 0 else "⬜" for x in row]))
        
        print("\nTarget (layer by layer):")
        for y in range(min(4, self.grid_size)):
            if np.any(self.target[:, y, :] > 0):
                print(f"\n  Layer Y={y}:")
                for row in self.target[:, y, :]:
                    print("  " + "".join(["🟨" if x > 0 else "⬜" for x in row]))
        
        match_score = np.sum((self.grid > 0) & (self.target > 0)) / np.sum(self.target > 0)
        print(f"\nMatch Score: {match_score:.2%}")

