"""
Text-Conditioned 3D Construction Environment
Agents learn to build structures based on text descriptions
Includes SCENT FIELDS for sparse reward mitigation
"""
import numpy as np
from scipy.ndimage import distance_transform_edt
from typing import Tuple, Dict, List
import json

class TextConditioned3DEnv:
    """
    Environment where agents learn language-grounded construction
    Text → Embedding → Policy → Actions → Structure
    """
    
    def __init__(self, num_agents=5, grid_size=8, local_obs_size=3):
        """
        Args:
            num_agents: Number of building agents
            grid_size: Training grid size (8 for speed, can deploy at 128+!)
            local_obs_size: Local observation size (3×3×3 makes agents scale-free)
        
        NOTE: Train small (8×8×8), deploy large (128×128×128)!
              Local observations make the policy grid-size agnostic.
        """
        self.num_agents = num_agents
        self.grid_size = grid_size
        self.local_size = local_obs_size  # 3x3x3 local observations
        self.max_steps = 150
        
        # State (3D)
        self.grid = np.zeros((grid_size, grid_size, grid_size), dtype=np.float32)
        self.agent_positions = np.zeros((num_agents, 3), dtype=np.int32)
        self.agent_has_block = np.zeros(num_agents, dtype=bool)
        
        # Target & scent field
        self.target = np.zeros((grid_size, grid_size, grid_size), dtype=np.float32)
        self.scent_field = np.zeros((grid_size, grid_size, grid_size), dtype=np.float32)
        
        # Text conditioning
        self.current_text = ""
        self.current_text_embedding = None
        
        self.step_count = 0
        
    def load_training_pair(self, text: str, voxels: List[dict]):
        """
        Load a text-voxel pair from training data
        Voxels should already be scaled to match self.grid_size
        (done by generate_training_data_anthropic.py)
        """
        self.current_text = text
        
        # Convert voxels to target grid
        self.target.fill(0)
        for v in voxels:
            x, y, z = v['x'], v['y'], v['z']
            if 0 <= x < self.grid_size and 0 <= y < self.grid_size and 0 <= z < self.grid_size:
                self.target[x, y, z] = 1.0
        
        # Generate SCENT FIELD (the magic sauce!)
        self._generate_scent_field()
        
    def _generate_scent_field(self):
        """
        Create potential field (gradient) toward target blocks
        This solves the sparse reward problem!
        """
        # Distance transform: each cell knows distance to nearest target
        distance_map = distance_transform_edt(1 - self.target)
        
        # Invert: targets have HIGH value, far away has LOW value
        max_dist = np.max(distance_map)
        if max_dist > 0:
            self.scent_field = 1.0 - (distance_map / max_dist)
        else:
            self.scent_field = self.target.copy()
        
        # Optional: Add smoothing for better gradients
        from scipy.ndimage import gaussian_filter
        self.scent_field = gaussian_filter(self.scent_field, sigma=0.5)
    
    def reset(self, text: str = None, voxels: List[dict] = None):
        """Reset with a text-voxel pair"""
        self.grid.fill(0)
        self.step_count = 0
        
        # Load training pair
        if text and voxels:
            self.load_training_pair(text, voxels)
        
        # Spawn agents at ground level edges
        for i in range(self.num_agents):
            edge = np.random.randint(0, 4)
            if edge == 0:
                self.agent_positions[i] = [0, 0, np.random.randint(0, self.grid_size)]
            elif edge == 1:
                self.agent_positions[i] = [np.random.randint(0, self.grid_size), 0, self.grid_size-1]
            elif edge == 2:
                self.agent_positions[i] = [self.grid_size-1, 0, np.random.randint(0, self.grid_size)]
            else:
                self.agent_positions[i] = [np.random.randint(0, self.grid_size), 0, 0]
        
        self.agent_has_block = np.ones(self.num_agents, dtype=bool)
        
        return self._get_observations()
    
    def _get_local_obs(self, agent_id: int) -> np.ndarray:
        """
        Get LOCAL observation (3x3x3 patch) around agent
        This is KEY for scalability and emergent behavior!
        """
        pos = self.agent_positions[agent_id]
        half = self.local_size // 2
        
        # Extract local patches with padding
        local_grid = np.zeros((self.local_size, self.local_size, self.local_size))
        local_scent = np.zeros((self.local_size, self.local_size, self.local_size))
        
        for dx in range(-half, half + 1):
            for dy in range(-half, half + 1):
                for dz in range(-half, half + 1):
                    wx = pos[0] + dx
                    wy = pos[1] + dy
                    wz = pos[2] + dz
                    
                    if (0 <= wx < self.grid_size and 
                        0 <= wy < self.grid_size and 
                        0 <= wz < self.grid_size):
                        local_grid[dx+half, dy+half, dz+half] = self.grid[wx, wy, wz]
                        local_scent[dx+half, dy+half, dz+half] = self.scent_field[wx, wy, wz]
        
        return local_grid, local_scent
    
    def _get_observations(self) -> Dict[str, np.ndarray]:
        """
        Get observations for all agents (LOCAL + TEXT)
        Each agent sees:
        - Position (3)
        - Local grid 3x3x3 (27)
        - Local scent field 3x3x3 (27)  
        - Has block (1)
        - Text embedding (384) added by policy
        Total: 58 features (local is better for learning!)
        """
        obs = {}
        for i in range(self.num_agents):
            local_grid, local_scent = self._get_local_obs(i)
            
            # NOTE: Text embedding will be added by the policy network
            # We just return the spatial observations here
            agent_obs = np.concatenate([
                self.agent_positions[i] / self.grid_size,  # (3)
                local_grid.flatten(),  # (27)
                local_scent.flatten(),  # (27)
                [float(self.agent_has_block[i])],  # (1)
            ], dtype=np.float32)
            
            obs[f'agent_{i}'] = agent_obs
        
        return obs
    
    def step(self, actions: Dict[str, int]) -> Tuple[Dict, Dict, Dict, Dict]:
        """Execute actions (same as before)"""
        self.step_count += 1
        
        # Execute each agent's action
        for i in range(self.num_agents):
            action = actions[f'agent_{i}']
            pos = self.agent_positions[i]
            
            # Movement (6 directions)
            if action == 0 and pos[0] > 0:  # Forward
                self.agent_positions[i][0] -= 1
            elif action == 2 and pos[0] < self.grid_size - 1:  # Backward
                self.agent_positions[i][0] += 1
            elif action == 1 and pos[2] < self.grid_size - 1:  # Right
                self.agent_positions[i][2] += 1
            elif action == 3 and pos[2] > 0:  # Left
                self.agent_positions[i][2] -= 1
            elif action == 4 and pos[1] < self.grid_size - 1:  # Up
                if pos[1] == 0 or self.grid[pos[0], pos[1]-1, pos[2]] > 0:
                    self.agent_positions[i][1] += 1
            elif action == 5 and pos[1] > 0:  # Down
                self.agent_positions[i][1] -= 1
            
            # Block actions
            elif action == 6:  # Place block
                if self.agent_has_block[i]:
                    self.grid[pos[0], pos[1], pos[2]] = 1.0
                    self.agent_has_block[i] = False
            elif action == 7:  # Pickup block
                if not self.agent_has_block[i] and self.grid[pos[0], pos[1], pos[2]] == 0:
                    self.agent_has_block[i] = True
        
        # Calculate rewards
        rewards = self._calculate_rewards()
        
        # Check if done
        done = self.step_count >= self.max_steps
        match_score = self._get_match_score()
        done = done or match_score > 0.85
        
        dones = {f'agent_{i}': done for i in range(self.num_agents)}
        dones['__all__'] = done
        
        obs = self._get_observations()
        infos = {f'agent_{i}': {'match_score': match_score} for i in range(self.num_agents)}
        
        return obs, rewards, dones, infos
    
    def _calculate_rewards(self) -> Dict[str, float]:
        """
        Reward shaping - heavily reward correct placements
        """
        rewards = {}
        
        for i in range(self.num_agents):
            reward = 0.0
            pos = self.agent_positions[i]
            
            # 1. REMOVED: Gradient following (was giving free points)
            # Agents should only get reward for actual placements
            
            # 2. Correct placement reward (MASSIVELY INCREASED)
            if self.grid[pos[0], pos[1], pos[2]] > 0 and self.target[pos[0], pos[1], pos[2]] > 0:
                reward += 100.0  # Was 10.0 - make success VERY rewarding!
            
            # 3. Wrong placement penalty (REDUCED)
            if self.grid[pos[0], pos[1], pos[2]] > 0 and self.target[pos[0], pos[1], pos[2]] == 0:
                reward -= 2.0  # Was 5.0 - less punishing, encourage exploration
            
            # 4. Completion bonus (INCREASED)
            match_score = self._get_match_score()
            reward += match_score * 20.0  # Was 1.0 - big reward for progress
            
            # 5. Time penalty (INCREASED)
            reward -= 0.1  # Was 0.01 - discourage wasting time
            
            # 6. NEW: Penalty for doing nothing
            # If agent has no block but there's an empty target nearby, penalize
            if not self.agent_has_block[i]:
                # Check if standing on empty target spot
                if self.target[pos[0], pos[1], pos[2]] > 0 and self.grid[pos[0], pos[1], pos[2]] == 0:
                    reward -= 5.0  # Should have placed a block here!
            
            rewards[f'agent_{i}'] = reward
        
        return rewards
    
    def _get_match_score(self) -> float:
        """Calculate structure match score"""
        if np.sum(self.target) == 0:
            return 0.0
        correct = np.sum((self.grid > 0) & (self.target > 0))
        total = np.sum(self.target > 0)
        return correct / total
    
    def render(self):
        """Visualize current state"""
        print(f"\nStep: {self.step_count} | Text: '{self.current_text}'")
        print(f"Match Score: {self._get_match_score():.1%}")
        print("\nLayers (Y=0 to top):")
        for y in range(min(4, self.grid_size)):
            if np.any(self.grid[:, y, :] > 0) or np.any(self.target[:, y, :] > 0):
                print(f"\n  Y={y}:")
                for x in range(self.grid_size):
                    row = ""
                    for z in range(self.grid_size):
                        if self.grid[x, y, z] > 0:
                            row += "🟦"
                        elif self.target[x, y, z] > 0:
                            row += "🟨"
                        else:
                            row += "⬜"
                    print(f"  {row}")

