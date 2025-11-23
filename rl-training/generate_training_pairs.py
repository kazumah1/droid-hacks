"""
Generate training pairs: Text → Voxels
Uses YOUR existing LLM voxel generation
Saves pairs for RL training
"""
import sys
import os
import json
import time

# Add parent directory to path to import from next-app
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'next-app', 'app'))

print("🎨 Generating Text → Voxel Training Pairs")
print("=" * 60)

# Training text prompts (diverse!)
TRAINING_PROMPTS = [
    # Basic shapes
    "pyramid 3",
    "pyramid 4",
    "pyramid 5",
    "cube 3",
    "cube 4",
    "wall 5x3",
    "wall 6x4",
    "tower 5",
    "tower 7",
    
    # Complex structures
    "bridge",
    "arch",
    "staircase",
    "platform",
    "fortress",
    "castle",
    
    # Descriptive
    "small pyramid",
    "large pyramid", 
    "tall tower",
    "short tower",
    "wide wall",
    "thin wall",
    "raised platform",
    "low platform",
    
    # Creative
    "letter T",
    "letter L",
    "letter H",
    "plus sign",
    "cross shape",
    
    # Combinations
    "two towers",
    "three pillars",
    "pyramid on platform",
    "wall with towers",
]

def generate_with_mock_llm(prompt: str) -> list:
    """
    REPLACE THIS with your actual LLM API call
    For now, generates mock voxels based on prompt keywords
    """
    voxels = []
    
    if "pyramid" in prompt.lower():
        # Generate pyramid
        size = 4
        if "small" in prompt or "3" in prompt:
            size = 3
        elif "large" in prompt or "5" in prompt:
            size = 5
            
        for y in range(size):
            layer_size = size - y
            for x in range(layer_size):
                for z in range(layer_size):
                    voxels.append({"x": x, "y": y, "z": z})
                    
    elif "tower" in prompt.lower():
        # Generate tower
        height = 5
        if "tall" in prompt or "7" in prompt:
            height = 7
        elif "short" in prompt or "3" in prompt:
            height = 3
            
        for y in range(height):
            voxels.append({"x": 2, "y": y, "z": 2})
            
    elif "wall" in prompt.lower():
        # Generate wall
        width = 5
        height = 3
        for y in range(height):
            for x in range(width):
                voxels.append({"x": x, "y": y, "z": 2})
                
    elif "cube" in prompt.lower():
        # Generate cube
        size = 3
        if "4" in prompt:
            size = 4
        for x in range(size):
            for y in range(size):
                for z in range(size):
                    voxels.append({"x": x, "y": y, "z": z})
    else:
        # Random structure
        import random
        for _ in range(random.randint(5, 15)):
            voxels.append({
                "x": random.randint(0, 7),
                "y": random.randint(0, 4),
                "z": random.randint(0, 7),
            })
    
    return voxels

def generate_all_pairs():
    """Generate all training pairs"""
    pairs = []
    
    for i, prompt in enumerate(TRAINING_PROMPTS):
        print(f"\n[{i+1}/{len(TRAINING_PROMPTS)}] Generating: '{prompt}'")
        
        # TODO: Replace with your actual LLM API:
        # from lib.ai_shapes import generateShapeFromText
        # voxels = await generateShapeFromText(prompt)
        
        voxels = generate_with_mock_llm(prompt)
        
        pair = {
            "text": prompt,
            "voxels": voxels,
            "voxel_count": len(voxels)
        }
        pairs.append(pair)
        
        print(f"   ✅ Generated {len(voxels)} voxels")
        
        # Rate limiting (if using real API)
        time.sleep(0.5)
    
    return pairs

def save_pairs(pairs, filename="training_pairs.json"):
    """Save pairs to JSON"""
    os.makedirs("data", exist_ok=True)
    filepath = os.path.join("data", filename)
    
    with open(filepath, 'w') as f:
        json.dump(pairs, f, indent=2)
    
    print(f"\n💾 Saved {len(pairs)} pairs to: {filepath}")
    
    # Statistics
    total_voxels = sum(p['voxel_count'] for p in pairs)
    avg_voxels = total_voxels / len(pairs)
    
    print(f"\n📊 Statistics:")
    print(f"   Total pairs: {len(pairs)}")
    print(f"   Total voxels: {total_voxels}")
    print(f"   Avg voxels per shape: {avg_voxels:.1f}")
    print(f"   Min voxels: {min(p['voxel_count'] for p in pairs)}")
    print(f"   Max voxels: {max(p['voxel_count'] for p in pairs)}")

if __name__ == "__main__":
    print("\n🚀 INSTRUCTIONS:")
    print("   1. If using MOCK data: Run as-is (testing)")
    print("   2. If using REAL LLM: Uncomment lines 98-99 and add API key")
    print()
    
    response = input("Generate training pairs? (y/n): ")
    if response.lower() != 'y':
        print("Cancelled.")
        sys.exit(0)
    
    pairs = generate_all_pairs()
    save_pairs(pairs)
    
    print("\n✅ Done! Next step:")
    print("   python train_text_conditioned.py")

