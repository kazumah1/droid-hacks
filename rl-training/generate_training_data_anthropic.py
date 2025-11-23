"""
Anthropic (Claude) adapter for YOUR actual LLM setup
Uses Claude Sonnet 4.5 exactly like your ai_shapes.ts
"""
import os
import json
import re
import asyncio
from anthropic import AsyncAnthropic
from typing import List, Dict

# Get API key (same as your Next.js app)
ANTHROPIC_API_KEY = os.getenv('NEXT_PUBLIC_ANTHROPIC_API_KEY') or os.getenv('ANTHROPIC_API_KEY')

# Training prompts (40+ diverse examples, sized for 16×16×16 grid)
TRAINING_PROMPTS = [
    # Basic shapes (small)
    "small pyramid 3", "pyramid 5", "large pyramid 7",
    "cube 4", "large cube 6",
    "wall 8x4", "long wall 12x3",
    "tower 6", "tall tower 10",
    
    # Medium structures
    "bridge 10 units long", "arched bridge", 
    "staircase 8 steps", "spiral staircase",
    "raised platform 8x8x2", "tiered platform",
    
    # Complex single structures
    "fortress with walls", "small castle", 
    "house with roof", "temple with columns",
    "watchtower", "observation deck",
    
    # Combinations (now they have room!)
    "two towers connected by bridge",
    "three pillars in a row",
    "pyramid on raised platform",
    "wall with two corner towers",
    "courtyard with four pillars",
    
    # Letters & symbols
    "letter T shape", "letter L shape", "letter H shape",
    "plus sign", "cross shape", "T-junction",
    
    # Architectural elements
    "colonnade 6 columns", "aqueduct",
    "amphitheater",
    
    # Variations for diversity
    "stepped pyramid", "smooth pyramid", 
    "hollow cube", "solid cube",
    "curved wall", "zigzag wall",

    # --- NEW ADDITIONS ---

    # Furniture & Small Scale (Tests precision)
    "large table 5x5", "simple chair", 
    "high-backed throne", "podium with steps",

    # Curved & Circular Approximations (Tests voxel resolution)
    "circular arena walls", "dome 8 units wide",
    "silo tower", "hexagon platform",

    # Enclosures & Mazes (Tests pathfinding/planning)
    "simple maze 10x10", "concentric square walls",
    "fenced enclosure", "bunker with windows",

    # Physics Stress Tests (Tests support/stability logic)
    "stone archway", "tunnel entrance",
    "inverted pyramid",  
    "T-shaped overhang",
    
    # Organic & Freeform (Tests creativity)
    "big bowl", "statue of liberty",
]


# System prompt from YOUR ai_shapes.ts (line 10-29)
SYSTEM_PROMPT = """You are a shape generator for a programmable matter simulator.

The world is a 3D voxel grid with x, y, z coordinates ranging from 0 to 15 (inclusive).
Given a short natural language command (like "pyramid 4" or "wall 6x3"),
you must respond with a JSON object ONLY, with this shape:

{
  "voxels": [
    {"x": 0, "y": 0, "z": 0},
    ...
  ]
}

Rules:
- voxels must form a single connected structure.
- do not exceed a 16x16x16 grid (0–15).
- y=0 is the ground.
- For a pyramid N, produce a stepped pyramid with N levels.
- For a wall W x H, produce a vertical wall with width and height.
- Center structures in the grid for better aesthetics.
- Never include any extra keys or commentary, only the JSON object."""

async def call_claude_for_voxels(prompt: str, client: AsyncAnthropic) -> List[Dict]:
    """
    Call Claude EXACTLY like your ai_shapes.ts does
    Returns integer grid coords (0-9)
    """
    # Same API call as your ai_shapes.ts line 56-62
    message = await client.messages.create(
        model='claude-sonnet-4-5-20250929',  # Same model
        max_tokens=10240,  # Increased for large structures (32×32×32 grid)
        messages=[
            {
                'role': 'user',
                'content': f'{SYSTEM_PROMPT}\n\nUser command: {prompt}'
            }
        ],
    )
    
    # Extract text (same as your ai_shapes.ts line 64)
    text = message.content[0].text if message.content[0].type == 'text' else ''
    
    # Remove markdown code blocks if present (Claude sometimes wraps in ```json)
    text = re.sub(r'```json\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'```\s*', '', text)
    
    # Parse JSON (same as your ai_shapes.ts line 67-70)
    json_start = text.find('{')
    json_end = text.rfind('}')
    
    if json_start == -1 or json_end == -1:
        raise Exception("No JSON found in response")
    
    json_str = text[json_start:json_end + 1]
    
    try:
        parsed = json.loads(json_str)
        voxels = parsed.get('voxels', [])
    except json.JSONDecodeError as e:
        # Debug: Print the problematic JSON around the error
        error_char = e.pos if hasattr(e, 'pos') else 1614
        start = max(0, error_char - 200)
        end = min(len(json_str), error_char + 200)
        
        print(f"\n   ❌ JSON Parse Error: {e}")
        print(f"   Error at character {error_char}")
        print(f"   JSON around error (chars {start}-{end}):")
        print(f"   ...{json_str[start:end]}...")
        print(f"\n   Full JSON length: {len(json_str)} chars")
        print(f"   Text after last '}}': '{text[json_end+1:json_end+100]}'")
        raise
    
    # Sanitize (same as your ai_shapes.ts line 74-80)
    sanitized = []
    for v in voxels:
        if v and isinstance(v.get('x'), (int, float)) and isinstance(v.get('y'), (int, float)) and isinstance(v.get('z'), (int, float)):
            sanitized.append({
                'x': max(0, min(15, round(v['x']))),
                'y': max(0, min(15, round(v['y']))),
                'z': max(0, min(15, round(v['z']))),
            })
    
    return sanitized

def scale_voxels(voxels: List[Dict], from_size: int = 16, to_size: int = 8) -> List[Dict]:
    """
    Scale voxels from LLM grid (16×16×16) to training grid (8×8×8)
    This allows training on smaller grids for speed!
    """
    if from_size == to_size:
        return voxels
    
    scale_factor = to_size / from_size
    scaled = []
    seen = set()  # Deduplicate after scaling
    
    for v in voxels:
        x = int(v['x'] * scale_factor)
        y = int(v['y'] * scale_factor)
        z = int(v['z'] * scale_factor)
        
        # Clamp to bounds
        x = max(0, min(to_size - 1, x))
        y = max(0, min(to_size - 1, y))
        z = max(0, min(to_size - 1, z))
        
        key = (x, y, z)
        if key not in seen:
            scaled.append({'x': x, 'y': y, 'z': z})
            seen.add(key)
    
    return scaled

def generate_fallback_pyramid() -> List[Dict]:
    """Fallback pyramid (same as your ai_shapes.ts line 33-42)"""
    voxels = []
    for y in range(3):
        size = 3 - y
        offset = (3 - size) // 2
        for i in range(size):
            for j in range(size):
                voxels.append({
                    'x': offset + i,
                    'y': y,
                    'z': offset + j
                })
    return voxels

async def generate_with_claude(prompt: str, client: AsyncAnthropic, training_grid_size: int = 8) -> List[Dict]:
    """
    Generate voxels using YOUR exact Claude setup
    Scales from LLM's 10×10×10 to training grid size (default 8×8×8)
    """
    try:
        voxels = await call_claude_for_voxels(prompt, client)
        
        if not voxels or len(voxels) == 0:
            print(f"   ⚠️  Empty response, using fallback")
            voxels = generate_fallback_pyramid()
        
        # Scale from LLM grid (16×16×16) to training grid (8×8×8 by default)
        scaled_voxels = scale_voxels(voxels, from_size=16, to_size=training_grid_size)
        
        if len(scaled_voxels) != len(voxels):
            print(f"   📐 Scaled from {len(voxels)} → {len(scaled_voxels)} voxels (16×16×16 → {training_grid_size}×{training_grid_size}×{training_grid_size})")
        
        return scaled_voxels
        
    except Exception as e:
        print(f"   ⚠️  Error: {e}")
        print(f"   Using fallback...")
        return scale_voxels(generate_fallback_pyramid(), from_size=16, to_size=training_grid_size)

async def generate_all_training_pairs(training_grid_size: int = 8):
    """
    Generate all training pairs using Claude
    
    Args:
        training_grid_size: Size of RL training grid (default 8 for speed)
                           LLM generates 10×10×10, we scale down
    """
    if not ANTHROPIC_API_KEY:
        raise Exception("ANTHROPIC_API_KEY not found! Set NEXT_PUBLIC_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY")
    
    client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    pairs = []
    
    print(f"\n🎨 Generating {len(TRAINING_PROMPTS)} text-voxel pairs")
    print(f"   LLM Grid: 16×16×16 (compact for reliable generation)")
    print(f"   Training Grid: {training_grid_size}×{training_grid_size}×{training_grid_size} (for speed)")
    print(f"   Scale Factor: 2x down for training, N×up for deployment")
    print(f"   Using YOUR Claude setup (claude-sonnet-4-5-20250929)")
    print("=" * 60)
    
    for i, prompt in enumerate(TRAINING_PROMPTS):
        print(f"\n[{i+1}/{len(TRAINING_PROMPTS)}] '{prompt}'")
        
        try:
            voxels = await generate_with_claude(prompt, client, training_grid_size)
            
            pair = {
                "text": prompt,
                "voxels": voxels,
                "voxel_count": len(voxels)
            }
            pairs.append(pair)
            
            print(f"   ✅ Generated {len(voxels)} voxels")
            
            # Rate limiting
            await asyncio.sleep(1.0)
            
        except Exception as e:
            print(f"   ❌ Fatal error: {e}")
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
    print("Using YOUR Anthropic Claude setup!")
    print("=" * 60)
    
    # Check API key
    if not ANTHROPIC_API_KEY:
        print("\n❌ ERROR: Anthropic API key not found!")
        print("\n   Set one of these environment variables:")
        print("   export NEXT_PUBLIC_ANTHROPIC_API_KEY='sk-ant-...'")
        print("   export ANTHROPIC_API_KEY='sk-ant-...'")
        return
    
    print(f"\n✅ Found API key: {ANTHROPIC_API_KEY[:20]}...")
    print(f"📝 Will generate {len(TRAINING_PROMPTS)} text-voxel pairs")
    print("   Using same model as your ai_shapes.ts: claude-sonnet-4-5-20250929")
    print("\n💡 Strategy:")
    print("   • LLM generates 16×16×16 shapes (fits in token limit)")
    print("   • Auto-scaled to 8×8×8 for FAST training (~45 min)")
    print("   • Deploy at 128×128×128 later (local obs = scale-free!)")
    
    # Auto-proceed in non-interactive mode (for remote training)
    try:
        response = input("\nProceed? (y/n): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return
    except (EOFError, OSError):
        # Non-interactive mode (nohup, ssh, etc.) - auto-proceed
        print("\n🤖 Non-interactive mode detected. Auto-proceeding...")
    
    # Can customize training grid size here
    training_grid_size = 8  # Start small for speed
    pairs = await generate_all_training_pairs(training_grid_size)
    
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

