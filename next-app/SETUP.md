# Setup Guide

## Quick Start

1. **Install Dependencies** ✅ (Already done)
   - three
   - @anthropic-ai/sdk
   - @types/three

2. **Set up Claude API Key**
   
   Create a `.env.local` file in the `next-app` directory:
   
   ```bash
   echo 'NEXT_PUBLIC_ANTHROPIC_API_KEY=your-key-here' > .env.local
   ```
   
   Replace `your-key-here` with your Anthropic API key.
   
   Get your key from: https://console.anthropic.com/settings/keys

3. **Run the Development Server**
   
   ```bash
   cd next-app
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features Implemented

✅ **Three.js Scene**
- Full-screen 3D canvas with orbit controls
- Grid floor and lighting setup
- Proper camera positioning

✅ **Minimal UI**
- Text input field for commands
- Generate and Clear buttons
- Quick example buttons
- Real-time status display
- Mode toggle (Centralized vs Autonomous swarm)

✅ **AI Integration**
- Claude 3.5 Sonnet integration
- Text-to-voxel generation
- Automatic fallback to pyramid if AI fails
- Voxel visualization in 3D space

✅ **Component-Based Assembly JSON** 🆕
- Claude generates structured assembly plans
- Breaks structures into logical components (foundation, walls, roof, etc.)
- Each component has coordinates, dependencies, and assembly order
- Automatic JSON file download
- Human-readable assembly instructions
- Example files for towers, bridges, pyramids

## How to Use

### Basic Building

1. Enter a shape command like:
   - `pyramid 6` - Creates a 6-level pyramid
   - `wall 10x4` - Creates a wall 10 wide by 4 tall
   - `tower 8` - Creates an 8-level tower
   - `bridge with two supports` - Creates a bridge structure

2. Click "Build Pyramid", "Build Wall", or "Go" button

3. The swarm will assemble the structure using the selected mode (Centralized or Autonomous)

4. Use your mouse to orbit, zoom, and pan the camera

### Advanced: Component-Based Assembly with Claude

1. Enter a detailed command in the text input (e.g., "build a house with foundation, walls, and roof")

2. Click **"✨ Generate Assembly JSON"** button

3. Claude will:
   - Analyze your command
   - Break the structure into logical components
   - Generate voxel coordinates for each component
   - Define dependencies between components
   - Automatically download a JSON file with the complete assembly plan

4. The structure will be built in the 3D scene

5. Optional actions:
   - Click **"💾 Download JSON"** to re-download the assembly plan
   - Click **"📋 Instructions"** to see human-readable build steps in the console

### Understanding the JSON Output

The generated JSON includes:
- **Components**: Logical parts (foundation, walls, roof, etc.)
- **Voxels**: Exact 3D coordinates for each block
- **Dependencies**: Which components must be built first
- **Assembly Order**: Step-by-step build sequence
- **Build Strategy**: High-level construction approach

See `ASSEMBLY-JSON-FORMAT.md` for complete documentation.

Example JSON files are in the `examples/` folder:
- `assembly_tower.json` - Multi-story tower with observation deck
- `assembly_bridge.json` - Bridge with supports and deck

## File Structure

```
next-app/
├── app/
│   ├── page.tsx                  # Main UI + Three.js scene
│   ├── lib/
│   │   ├── microbot.ts           # Microbot 3D mesh creation
│   │   ├── swarm.ts              # Centralized swarm controller
│   │   ├── autonomous-swarm.ts   # Autonomous swarm system
│   │   ├── slots.ts              # Slot-based assembly
│   │   ├── stigmergy.ts          # Gravity sorting algorithm
│   │   ├── ai_shapes.ts          # Basic AI voxel generation
│   │   └── ai-assembly.ts        # 🆕 Component-based assembly JSON
│   └── api/
│       └── generate-assembly/
│           └── route.ts          # 🆕 Assembly generation API
├── examples/
│   ├── assembly_tower.json       # 🆕 Example tower structure
│   └── assembly_bridge.json      # 🆕 Example bridge structure
├── ASSEMBLY-JSON-FORMAT.md       # 🆕 JSON format documentation
├── .env.local                    # API keys (create this!)
└── package.json
```

## What's New

**Component-Based Assembly System** - The latest feature allows Claude to generate sophisticated assembly plans:

- Natural language to structured components
- Each component has clear dependencies
- Gravity-stable build sequences
- Downloadable JSON for external tools
- Human-readable instructions
- Example structures (tower, bridge, pyramid)

## Custom Commands to Try

Try these commands with the **"✨ Generate Assembly JSON"** button:

- `build a tall observation tower with a wide base`
- `create a bridge connecting two platforms`
- `make a house with foundation, walls, and peaked roof`
- `construct a castle with towers and walls`
- `build a pyramid temple with entrance`
- `create a multi-level parking structure`

## API Usage

You can also call the API directly:

```bash
curl -X POST http://localhost:3000/api/generate-assembly \
  -H "Content-Type: application/json" \
  -d '{"command": "build a tower"}'
```

## Next Steps

Potential enhancements:
- Import custom JSON assembly files
- Visualize components in different colors
- Real-time assembly progress per component
- Component-based swarm optimization
- Multi-structure coordination

