"""
Text-Conditioned Policy Network
Policy that understands BOTH vision (local observations) AND language (text)
"""
import torch
import torch.nn as nn
from sentence_transformers import SentenceTransformer

class TextConditionedPolicy(nn.Module):
    """
    Policy network with text conditioning
    Input: Local observations (58) + Text embedding (384)
    Output: Action probabilities (8 actions)
    """
    
    def __init__(self, obs_size=58, text_emb_size=384, hidden_size=128, action_size=8):
        super().__init__()
        
        # Text encoder (frozen pretrained model)
        self.text_encoder = SentenceTransformer('all-MiniLM-L6-v2')
        for param in self.text_encoder.parameters():
            param.requires_grad = False  # Freeze text encoder
        
        # Observation encoder
        self.obs_encoder = nn.Sequential(
            nn.Linear(obs_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
        )
        
        # Text projection (reduce 384 → 64)
        self.text_proj = nn.Sequential(
            nn.Linear(text_emb_size, 64),
            nn.ReLU(),
        )
        
        # Fusion layer (combines vision + language)
        self.fusion = nn.Sequential(
            nn.Linear(hidden_size + 64, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
        )
        
        # Action head
        self.actor = nn.Sequential(
            nn.Linear(hidden_size // 2, action_size),
            nn.Softmax(dim=-1)
        )
        
        # Cache for text embeddings (avoid recomputing)
        self.text_cache = {}
        
    def encode_text(self, text: str) -> torch.Tensor:
        """Encode text to embedding (with caching)"""
        if text in self.text_cache:
            return self.text_cache[text].clone()
        
        with torch.no_grad():
            embedding = self.text_encoder.encode(text, convert_to_tensor=True)
        
        # Detach from inference mode and create normal tensor
        embedding = embedding.clone().detach()
        
        self.text_cache[text] = embedding
        return embedding.clone()
    
    def forward(self, obs: torch.Tensor, text_emb: torch.Tensor):
        """
        Forward pass with text conditioning
        obs: (batch, 58) - local observations
        text_emb: (batch, 384) - text embeddings
        """
        # Encode observations
        obs_features = self.obs_encoder(obs)
        
        # Project text embeddings
        text_features = self.text_proj(text_emb)
        
        # Fuse multimodal features
        combined = torch.cat([obs_features, text_features], dim=1)
        fused = self.fusion(combined)
        
        # Get action probabilities
        action_probs = self.actor(fused)
        
        return action_probs
    
    def act(self, obs: torch.Tensor, text: str, device='cpu'):
        """
        Sample action given observation and text
        """
        # Encode text (already cloned and detached in encode_text)
        text_emb = self.encode_text(text).unsqueeze(0).to(device)
        
        # Get action probabilities
        action_probs = self.forward(obs, text_emb)
        
        # Sample action
        dist = torch.distributions.Categorical(action_probs)
        action = dist.sample()
        log_prob = dist.log_prob(action)
        
        return action.item(), log_prob
    
    def evaluate_actions(self, obs: torch.Tensor, text_emb: torch.Tensor, actions: torch.Tensor):
        """
        Evaluate actions for PPO training
        """
        action_probs = self.forward(obs, text_emb)
        dist = torch.distributions.Categorical(action_probs)
        
        action_log_probs = dist.log_prob(actions)
        dist_entropy = dist.entropy()
        
        return action_log_probs, dist_entropy

