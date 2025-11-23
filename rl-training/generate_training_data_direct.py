"""
Direct adapter for YOUR existing LLM setup
Calls OpenAI exactly like your ai_shapes.ts does
No manual integration needed!
"""
import os
import json
import asyncio
import aiohttp
from typing import List, Dict

# Get API key from environment (same as your Next.js app)
OPENAI_API_KEY = os.getenv('NEXT_PUBLIC_OPENAI_API_KEY') or os.getenv('OPENAI_API_KEY')
CELL_SIZE = 0.6  # Same as your ai_shapes.ts

# Training prompts (30+ diverse examples)
TRAINING_PROMPTS = [
    # Basic shapes
    "pyramid 3", "pyramid 4", "pyramid 5",
    "cube 3", "cube 4",
    "wall 5x3", "wall 6x4",
    "tower 5", "tower 7",
    
    # Complex
    "bridge", "arch", "staircase", "platform",
    "fortress", "castle", "house",
    
    # Descriptive
    "small pyramid", "large pyramid",
    "tall tower", "short tower",
    "wide wall", "thin wall",
    "raised platform",
    
    # Creative
    "letter T", "letter L", "letter H",
    "plus sign", "cross shape",
    
    # Combinations
    "two towers", "three pillars",
    "pyramid on platform", "wall with towers",
]

async def call_openai_for_voxels(prompt: str) -> List[Dict]:
    """
    Call OpenAI EXACTLY like your ai_shapes.ts does
    Returns raw integer grid coords
    """
    if not OPENAI_API_KEY:
        raise Exception("OPENAI_API_KEY not found! Set NEXT_PUBLIC_OPENAI_API_KEY or OPENAI_API_KEY")
    
    # Same system prompt as your ai_shapes.ts line 40-46
    system_prompt = """
You are a shape planner for a programmable matter swarm. 
Given a user command, output a JSON array of integer coordinates in a 10x10x10 grid, like:
[{ "x": 0, "y": 0, "z": 0 }, ...]
Do NOT include any extra text, only raw JSON.
Prefer grounded structures (start y=0) and avoid floating blocks.
"""

    async with aiohttp.ClientSession() as session:
        payload = {
            "model": "gpt-4o-mini",  # Same as your ai_shapes.ts
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,  # Same as yours
            "max_tokens": 512,
        }
        
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }
        
        async with session.post(
            "https://api.openai.com/v1/chat/completions",
            json=payload,
            headers=headers
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"OpenAI error {response.status}: {error_text}")
            
            data = await response.json()
            raw = data['choices'][0]['message']['content'].strip()
            
            # Extract JSON (same as your ai_shapes.ts line 72)
            json_str = raw.replace('```json', '').replace('```', '')
            parsed = json.loads(json_str)
            
            return parsed

def generate_fallback_pyramid() -> List[Dict]:
    """Same fallback as your ai_shapes.ts line 80-96"""
    voxels = []
    levels = 4
    
    for level in range(levels):
        size = levels - level
        offset = (size - 1) / 2
        for i in range(size):
            for j in range(size):
                # Use INTEGER coords (before scaling)
                x = int(i - offset + 5)  # Center in 10x10 grid
                z = int(j - offset + 5)
                y = level
                voxels.append({"x": x, "y": y, "z": z})
    
    return voxels

def generate_fallback_wall() -> List[Dict]:
    """Same fallback as your ai_shapes.ts line 102-119"""
    voxels = []
    width = 8
    height = 3
    start_x = 5 - width // 2  # Center in 10x10 grid
    z = 5  # Center
    
    for i in range(width):
        for h in range(height):
            voxels.append({
                "x": start_x + i,
                "y": h,
                "z": z
            })
    
    return voxels

async def generate_with_your_llm(prompt: str) -> List[Dict]:
    """
    Generate voxels using YOUR exact LLM setup
    Returns integer grid coords (NOT scaled)
    """
    try:
        voxels = await call_openai_for_voxels(prompt)
        
        if not voxels or len(voxels) == 0:
            # Fallback (same as your ai_shapes.ts)
            lower = prompt.lower()
            voxels = generate_fallback_wall() if 'wall' in lower else generate_fallback_pyramid()
        
        return voxels
        
    except Exception as e:
        print(f"   ⚠️  LLM error: {e}")
        print(f"   Using fallback...")
        lower = prompt.lower()
        return generate_fallback_wall() if 'wall' in lower else generate_fallback_pyramid()

async def generate_all_training_pairs():
    """Generate all training pairs"""
    pairs = []
    
    print(f"\n🎨 Generating {len(TRAINING_PROMPTS)} text-voxel pairs")
    print(f"   Using YOUR OpenAI setup (gpt-4o-mini, temp=0.2)")
    print("=" * 60)
    
    for i, prompt in enumerate(TRAINING_PROMPTS):
        print(f"\n[{i+1}/{len(TRAINING_PROMPTS)}] '{prompt}'")
        
        try:
            voxels = await generate_with_your_llm(prompt)
            
            pair = {
                "text": prompt,
                "voxels": voxels,
                "voxel_count": len(voxels)
            }
            pairs.append(pair)
            
            print(f"   ✅ Generated {len(voxels)} voxels")
            
            # Rate limiting (OpenAI)
            await asyncio.sleep(1.0)
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            continue
    
    return pairs

def save_training_data(pairs, filename="training_pairs.json"):
    """Save to JSON"""
    os.makedirs("data", exist_ok=True)
    filepath = os.path.join("data", filename)
    
    with open(filepath, 'w') as f:
        json.dump(pairs, f, indent=2)
    
    print(f"\n💾 Saved {len(pairs)} pairs to: {filepath}")
    
    # Stats
    total_voxels = sum(p['voxel_count'] for p in pairs)
    avg_voxels = total_voxels / len(pairs) if pairs else 0
    
    print(f"\n📊 Statistics:")
    print(f"   Total pairs: {len(pairs)}")
    print(f"   Total voxels: {total_voxels}")
    print(f"   Avg voxels/shape: {avg_voxels:.1f}")
    if pairs:
        print(f"   Min: {min(p['voxel_count'] for p in pairs)}")
        print(f"   Max: {max(p['voxel_count'] for p in pairs)}")

async def main():
    print("\n" + "=" * 60)
    print("TEXT-TO-VOXEL TRAINING DATA GENERATOR")
    print("Using YOUR existing OpenAI setup!")
    print("=" * 60)
    
    # Check API key
    if not OPENAI_API_KEY:
        print("\n❌ ERROR: OpenAI API key not found!")
        print("\n   Set one of these environment variables:")
        print("   export NEXT_PUBLIC_OPENAI_API_KEY='sk-...'")
        print("   export OPENAI_API_KEY='sk-...'")
        return
    
    print(f"\n✅ Found API key: {OPENAI_API_KEY[:20]}...")
    print(f"📝 Will generate {len(TRAINING_PROMPTS)} text-voxel pairs")
    print("   Using same model as your ai_shapes.ts: gpt-4o-mini")
    
    response = input("\nProceed? (y/n): ")
    if response.lower() != 'y':
        print("Cancelled.")
        return
    
    pairs = await generate_all_training_pairs()
    
    if pairs:
        save_training_data(pairs)
        
        print("\n✅ SUCCESS! Training data ready.")
        print("\n📋 Next steps:")
        print("   1. Verify: cat data/training_pairs.json | head -50")
        print("   2. Train: python train_text_conditioned.py --curriculum")
        print("   3. Wait: 45-60 min on GPU")
        print("   4. Deploy: cp trained_models/*.onnx ../next-app/public/")
    else:
        print("\n❌ No training pairs generated!")

if __name__ == "__main__":
    asyncio.run(main())

