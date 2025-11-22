# Quick Start Guide

Get the programmable matter swarm with Claude AI integration running in 5 minutes.

## Prerequisites

- Node.js 18+ and npm installed
- Anthropic API key ([get one here](https://console.anthropic.com/settings/keys))
- Modern browser (Chrome, Firefox, Safari, Edge)

## Installation Steps

### 1. Clone & Install

```bash
cd droid-hacks/next-app
npm install
```

This installs:
- Next.js 16
- Three.js for 3D rendering
- Anthropic SDK for Claude AI
- TypeScript and dev dependencies

### 2. Configure API Key

Create `.env.local` file in the `next-app` directory:

```bash
echo 'NEXT_PUBLIC_ANTHROPIC_API_KEY=your_anthropic_api_key_here' > .env.local
```

Replace `your_anthropic_api_key_here` with your actual API key from Anthropic.

**Get your key:**
1. Go to https://console.anthropic.com/settings/keys
2. Click "Create Key"
3. Copy the key
4. Paste it in `.env.local`

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## First Build

You should see:
- 3D scene with a grid floor
- 280 microbots assembling a pyramid
- Control panel on the right

### Try These Actions

1. **Switch Modes**: Click "Autonomous Swarm" to see decentralized behavior
2. **Build Wall**: Click "Build Wall" for a different structure
3. **Custom Command**: Type `tower 8` and click "Go"
4. **Scatter**: Click "Scatter" to reset the swarm

### Generate Assembly JSON

1. Type a command: `build a house with walls and roof`
2. Click **"✨ Generate Assembly JSON"**
3. Wait 2-3 seconds for Claude to generate
4. JSON file downloads automatically
5. Watch the swarm build your structure

The JSON includes:
- Component breakdown (foundation, walls, roof, etc.)
- Exact voxel coordinates
- Build dependencies
- Assembly order

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
npm run dev -- -p 3001
```

### Missing Dependencies

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### API Key Not Working

1. Check `.env.local` exists in `next-app/` directory
2. Verify no spaces around `=` in the file
3. Restart the dev server after creating `.env.local`
4. Check the key is valid at https://console.anthropic.com/

### "dangerouslyAllowBrowser" Warning

This is expected for development. For production, implement server-side API routes (already included at `/api/generate-assembly`).

### Swarm Not Moving

1. Check browser console for errors
2. Verify Three.js loaded correctly
3. Try clicking "Scatter" then "Build Pyramid"
4. Refresh the page

## Project Structure

```
next-app/
├── app/
│   ├── page.tsx                  # Main application
│   ├── lib/
│   │   ├── microbot.ts           # Bot 3D models
│   │   ├── swarm.ts              # Centralized controller
│   │   ├── autonomous-swarm.ts   # Autonomous system
│   │   ├── ai-assembly.ts        # Claude integration ⭐
│   │   └── component-visualizer.ts # Visualization utils
│   └── api/
│       └── generate-assembly/    # API endpoint
├── examples/                     # Example JSON files
└── .env.local                    # Your API key (create this!)
```

## Next Steps

### Explore Examples

Check out pre-made assembly plans:
```bash
cat examples/assembly_tower.json
cat examples/assembly_bridge.json
```

### Read Documentation

- `SETUP.md` - Complete setup guide
- `ASSEMBLY-JSON-FORMAT.md` - JSON structure reference
- `CLAUDE-INTEGRATION.md` - AI integration details

### Customize

Edit `page.tsx` to:
- Change number of bots (line 188: `const numBots = 280`)
- Adjust cell size (line 15: `const CELL_SIZE = 0.6`)
- Modify colors and lighting
- Add custom commands

### Try Advanced Commands

```
build a tall observation tower with a wide base
create a bridge connecting two platforms  
make a medieval castle with corner towers
construct a pyramid temple with entrance
build a lighthouse on a circular platform
```

## Development Tips

### Hot Reload

Next.js automatically reloads on file changes. Edit any file in `app/` and see changes instantly.

### Console Logging

Open browser DevTools (F12) to see:
- Assembly plan JSON
- Build progress
- Error messages
- Assembly instructions

### Component Visualization

The system logs component details. Click "📋 Instructions" to see the full build plan in the console.

### Performance

- Reduce bot count for slower machines
- Disable fog/effects if laggy
- Use Chrome for best Three.js performance

## API Usage

### Generate via API

```bash
curl -X POST http://localhost:3000/api/generate-assembly \
  -H "Content-Type: application/json" \
  -d '{"command": "build a tower"}'
```

### Import Custom JSON

```typescript
import myStructure from './examples/assembly_tower.json';
const voxels = assemblyPlanToVoxels(myStructure);
// Build it!
```

## Production Deployment

For production:

1. **Move API key server-side**
   - Remove `NEXT_PUBLIC_` prefix
   - Use API routes only
   - Don't set `dangerouslyAllowBrowser`

2. **Build for production**
   ```bash
   npm run build
   npm start
   ```

3. **Deploy to Vercel**
   ```bash
   vercel
   ```
   
4. **Set environment variables** in deployment platform

## Cost Considerations

Claude API usage costs (approximate):
- Haiku: $0.001-0.003 per generation
- Sonnet: $0.01-0.03 per generation

Strategies to minimize costs:
- Use Haiku for simple structures
- Cache common plans
- Implement rate limiting
- Set up usage monitoring

## Community

- Report issues on GitHub
- Share your custom structures
- Contribute component examples
- Improve Claude prompts

## License

MIT - See LICENSE file for details

---

**Ready to build?** Open [http://localhost:3000](http://localhost:3000) and start creating! 🚀

