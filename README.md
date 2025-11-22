# Droid Hacks - Programmable Matter Swarm

**AI-Powered Self-Assembling Microbot Swarm with Claude Integration**

A Next.js + Three.js simulation of programmable matter inspired by *Big Hero 6*. Natural language commands are converted into component-based assembly plans using Claude AI, then executed by a swarm of 280+ autonomous microbots.

---

## ✨ Key Features

🤖 **Claude AI Integration** - Natural language → structured component assembly
- Breaks structures into logical components (foundation, walls, roof, etc.)
- Generates precise 3D voxel coordinates
- Defines build dependencies and order
- Exports downloadable JSON assembly files

🔮 **Two Swarm Modes**
- **Centralized Controller**: Global coordinator assigns tasks
- **Autonomous Swarm**: Each bot makes independent decisions using stigmergy

🎮 **Real-Time 3D Visualization**
- 280 microbots with metallic bodies and glowing magnetic ends
- Smooth animations with orbit controls
- Cinematic lighting and fog effects
- Component-based color visualization

📋 **Stigmergy Pipeline**
- Gravity-based voxel sorting
- Dependency-aware slot creation
- Physical construction rules (no floating blocks)
- Optimized build sequences

---

## 🚀 Quick Start

```bash
cd next-app
npm install
echo 'NEXT_PUBLIC_ANTHROPIC_API_KEY=your_key' > .env.local
npm run dev
```

Open http://localhost:3000

**Get API Key**: https://console.anthropic.com/settings/keys

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup.

---

## 📖 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - 5-minute setup guide
- **[next-app/SETUP.md](./next-app/SETUP.md)** - Complete features & usage
- **[CLAUDE-INTEGRATION.md](./CLAUDE-INTEGRATION.md)** - AI integration details
- **[next-app/ASSEMBLY-JSON-FORMAT.md](./next-app/ASSEMBLY-JSON-FORMAT.md)** - JSON structure reference

---

## 🎯 How It Works

```
Natural Language Command
        ↓
Claude 3.5 Sonnet AI
        ↓
Component-Based JSON
  (with dependencies)
        ↓
Stigmergy Engine
  (gravity sorting)
        ↓
Slot Assignment
        ↓
Swarm Controller
        ↓
3D Visualization
```

---

## 🧪 Try These Commands

### Basic Shapes
```
pyramid 6
wall 10x4
tower 8
```

### With Claude AI (Click "✨ Generate Assembly JSON")
```
build a tall observation tower with a wide base
create a bridge connecting two platforms
make a house with foundation, walls, and peaked roof
construct a castle with corner towers and connecting walls
build a pyramid temple with entrance stairs
```

---

## 📦 What Gets Generated

Claude outputs structured JSON like this:

```json
{
  "name": "Tower Structure",
  "components": [
    {
      "id": "foundation",
      "name": "Foundation Base",
      "voxels": [{"x": 3, "y": 0, "z": 3}, ...],
      "dependencies": [],
      "assemblyOrder": 1
    },
    {
      "id": "tower_shaft",
      "name": "Tower Shaft",
      "voxels": [{"x": 4, "y": 1, "z": 4}, ...],
      "dependencies": ["foundation"],
      "assemblyOrder": 2
    }
  ],
  "buildStrategy": "Ground-up construction...",
  "estimatedTime": "~60 seconds"
}
```

Each component includes:
- Unique ID and human-readable name
- Exact 3D coordinates for each voxel
- Dependencies (what must be built first)
- Assembly order (build sequence)

---

## 🏗️ Project Structure

```
next-app/
├── app/
│   ├── page.tsx                      # Main UI + Three.js scene
│   ├── lib/
│   │   ├── microbot.ts               # 3D bot models
│   │   ├── swarm.ts                  # Centralized controller
│   │   ├── autonomous-swarm.ts       # Autonomous system
│   │   ├── slots.ts                  # Slot-based assembly
│   │   ├── stigmergy.ts              # Gravity sorting
│   │   ├── ai-assembly.ts            # Claude integration ⭐
│   │   └── component-visualizer.ts   # Visualization utils
│   └── api/
│       └── generate-assembly/        # API endpoint
├── examples/
│   ├── assembly_tower.json           # Example tower
│   └── assembly_bridge.json          # Example bridge
└── .env.local                        # Your API key
```

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **3D Graphics**: Three.js with orbit controls
- **AI**: Anthropic Claude 3.5 Sonnet
- **Styling**: Tailwind CSS 4
- **Architecture**: Stigmergy-based coordination

---

## 🎨 Component Visualization

The system can visualize each component in different colors:

```typescript
import { createComponentVisualizations } from '@/app/lib/component-visualizer';
const viz = createComponentVisualizations(plan, scene);
```

Utilities included:
- Color-coded component rendering
- Build progress animations
- ASCII art representation
- Validation & statistics

---

## 📊 Example Outputs

See `next-app/examples/` for:
- `assembly_tower.json` - Multi-level tower with observation deck
- `assembly_bridge.json` - Bridge with support towers and deck

---

## 🔑 API Usage

### Client-Side
```typescript
import { generateAssemblyPlan } from '@/app/lib/ai-assembly';
const plan = await generateAssemblyPlan('build a tower');
```

### Server-Side API
```bash
curl -X POST http://localhost:3000/api/generate-assembly \
  -H "Content-Type: application/json" \
  -d '{"command": "build a tower"}'
```

---

## 💡 How Swarm Modes Work

### Centralized Mode
- Global controller assigns slots to bots
- Optimal task allocation
- Predictable behavior

### Autonomous Mode
- Each bot independently scans for slots
- Distributed decision-making
- Emergent behavior patterns
- More realistic to nature

---

## 🔬 Advanced Features

- **Dependency Graphs**: Ensures gravity-stable construction
- **Parallel Assembly**: Independent components build simultaneously
- **Progress Tracking**: Per-component completion status
- **Validation**: Checks for circular dependencies, out-of-bounds voxels
- **Human Instructions**: Generate readable build steps

---

## 🚨 Troubleshooting

### API Key Issues
```bash
# Verify file exists
ls -la next-app/.env.local

# Check contents (should have NEXT_PUBLIC_ANTHROPIC_API_KEY=...)
cat next-app/.env.local

# Restart server after creating .env.local
```

### Swarm Not Building
1. Open browser console (F12)
2. Check for errors
3. Click "Scatter" then try building again
4. Verify JSON downloaded successfully

---

## 🎓 Learning Resources

- [Stigmergy Explanation](https://en.wikipedia.org/wiki/Stigmergy)
- [Three.js Documentation](https://threejs.org/docs/)
- [Anthropic Claude Docs](https://docs.anthropic.com/)
- [Swarm Intelligence Basics](https://en.wikipedia.org/wiki/Swarm_intelligence)

---

## 🤝 Contributing

Contributions welcome! Areas to explore:

- Improve Claude prompts for better structures
- Add new component types (curved surfaces, arches)
- Implement collision detection
- Multi-structure coordination
- Material types (glass, metal, stone)
- VR/AR visualization

---

## 📝 License

MIT License - See LICENSE file

---

## 🎬 Demo

Run `npm run dev` and:
1. Watch the pyramid auto-build
2. Try "Build Wall" button
3. Enter custom command: `tower 8`
4. Click "✨ Generate Assembly JSON" with command: `build a castle with towers`
5. Watch Claude generate components and swarm assemble

---

## 🌟 Credits

Inspired by the microbots from *Big Hero 6* and swarm robotics research.

Built with:
- Anthropic Claude AI
- Three.js 3D engine
- Next.js framework
- Stigmergy algorithms

---

**Ready to build?** `npm run dev` and start creating! 🚀
