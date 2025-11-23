"""
Integration script: Hook up YOUR existing LLM voxel generation
to the RL training pipeline

INSTRUCTIONS:
1. Your team already has: Text → LLM API → Voxels
2. This script adapts it for RL training
3. Edit the import path below to point to your code
"""
import sys
import os
import json
import asyncio

# TODO: UPDATE THIS PATH to your actual LLM code location
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'next-app', 'app', 'lib'))

try:
    # Try to import your existing LLM function
    # Adjust the import based on your actual file structure
    from ai_shapes import generateShapeFromText
    print("✅ Found your LLM function!")
    HAS_REAL_LLM = True
except ImportError as e:
    print(f"⚠️  Could not import your LLM function: {e}")
    print("   Using mock data generator instead")
    print("   To use real LLM, fix the import path above")
    HAS_REAL_LLM = False

# Training prompts
TRAINING_PROMPTS = [
    # Basic shapes
    "pyramid 3", "pyramid 4", "pyramid 5",
    "cube 3", "cube 4",
    "wall 5x3", "wall 6x4",
    "tower 5", "tower 7",
    
    # Complex
    "bridge", "arch", "staircase", "platform",
    "fortress", "castle",
    
    # Descriptive
    "small pyramid", "large pyramid",
    "tall tower", "short tower",
    "wide wall", "thin wall",
    
    # Creative
    "letter T", "letter L", "letter H",
    "plus sign", "cross shape",
    
    # Combinations
    "two towers", "three pillars",
    "pyramid on platform", "wall with towers",
]

async def generate_with_real_llm(prompt: str):
    """Use YOUR existing LLM function"""
    if not HAS_REAL_LLM:
        raise Exception("Real LLM not available")
    
    # Call your existing function
    voxels = await generateShapeFromText(prompt)
    
    # Convert to standard format if needed
    # Assuming your function returns: [{x, y, z}, ...]
    return voxels

def generate_with_mock(prompt: str):
    """Fallback mock generator"""
    print(f"   (Using mock data for: '{prompt}')")
    voxels = []
    
    # Simple mock based on keywords
    if "pyramid" in prompt.lower():
        size = 4
        if "small" in prompt or "3" in prompt:
            size = 3
        for y in range(size):
            layer_size = size - y
            for x in range(layer_size):
                for z in range(layer_size):
                    voxels.append({"x": x, "y": y, "z": z})
    elif "tower" in prompt.lower():
        height = 5
        if "tall" in prompt:
            height = 7
        for y in range(height):
            voxels.append({"x": 2, "y": y, "z": 2})
    elif "cube" in prompt.lower():
        size = 3
        for x in range(size):
            for y in range(size):
                for z in range(size):
                    voxels.append({"x": x, "y": y, "z": z})
    else:
        # Random
        import random
        for _ in range(random.randint(8, 20)):
            voxels.append({
                "x": random.randint(0, 7),
                "y": random.randint(0, 4),
                "z": random.randint(0, 7),
            })
    
    return voxels

async def generate_all_pairs():
    """Generate training data using your LLM"""
    pairs = []
    
    print(f"\n🎨 Generating {len(TRAINING_PROMPTS)} text-voxel pairs")
    print("=" * 60)
    
    for i, prompt in enumerate(TRAINING_PROMPTS):
        print(f"\n[{i+1}/{len(TRAINING_PROMPTS)}] '{prompt}'")
        
        try:
            if HAS_REAL_LLM:
                voxels = await generate_with_real_llm(prompt)
                print(f"   ✅ LLM generated {len(voxels)} voxels")
            else:
                voxels = generate_with_mock(prompt)
                print(f"   ⚠️  Mock generated {len(voxels)} voxels")
            
            pair = {
                "text": prompt,
                "voxels": voxels,
                "voxel_count": len(voxels)
            }
            pairs.append(pair)
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            print(f"   Skipping this prompt")
            continue
        
        # Rate limiting (if using real API)
        if HAS_REAL_LLM:
            await asyncio.sleep(1.0)
    
    return pairs

def save_training_data(pairs, filename="training_pairs.json"):
    """Save to JSON for RL training"""
    os.makedirs("data", exist_ok=True)
    filepath = os.path.join("data", filename)
    
    with open(filepath, 'w') as f:
        json.dump(pairs, f, indent=2)
    
    print(f"\n💾 Saved {len(pairs)} pairs to: {filepath}")
    
    # Stats
    total_voxels = sum(p['voxel_count'] for p in pairs)
    avg_voxels = total_voxels / len(pairs) if pairs else 0
    
    print(f"\n📊 Statistics:")
    print(f"   Total training pairs: {len(pairs)}")
    print(f"   Total voxels: {total_voxels}")
    print(f"   Avg voxels per shape: {avg_voxels:.1f}")
    if pairs:
        print(f"   Min voxels: {min(p['voxel_count'] for p in pairs)}")
        print(f"   Max voxels: {max(p['voxel_count'] for p in pairs)}")

async def main():
    print("\n" + "=" * 60)
    print("TEXT-TO-VOXEL TRAINING DATA GENERATOR")
    print("=" * 60)
    
    if HAS_REAL_LLM:
        print("\n✅ Using YOUR existing LLM function")
        print("   This will generate REAL training data from your API")
    else:
        print("\n⚠️  Using MOCK data generator")
        print("   To use your real LLM:")
        print("   1. Edit line 17-18 of this file")
        print("   2. Point to your ai_shapes.py location")
        print("   3. Ensure your LLM API is accessible")
    
    print(f"\n📝 Will generate {len(TRAINING_PROMPTS)} text-voxel pairs")
    print("   Examples: 'pyramid 4', 'castle', 'tall tower', etc.")
    
    response = input("\nProceed? (y/n): ")
    if response.lower() != 'y':
        print("Cancelled.")
        return
    
    pairs = await generate_all_pairs()
    
    if pairs:
        save_training_data(pairs)
        
        print("\n✅ SUCCESS! Training data ready.")
        print("\n📋 Next steps:")
        print("   1. Verify data looks good: cat data/training_pairs.json | head")
        print("   2. Start training: python train_text_conditioned.py --curriculum")
        print("   3. Expected time: 45-60 min on GPU")
    else:
        print("\n❌ No training pairs generated. Check errors above.")

if __name__ == "__main__":
    asyncio.run(main())

