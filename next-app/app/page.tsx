// app/page.tsx
// Builder view: full Three.js scene + UI, wired into stigmergy + swarm logic.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createMicrobotMesh } from '@/app/lib/microbot';
import { buildSlotsFromVoxels } from '@/app/lib/slots';
import { Bot, SwarmController } from '@/app/lib/swarm';
import { gravitySortVoxels, type Voxel } from '@/app/lib/stigmergy';
import { AutonomousBot, AutonomousSwarmSystem } from '@/app/lib/autonomous-swarm';
import {
  generateAssemblyPlan,
  downloadAssemblyPlan,
  assemblyPlanToVoxels,
  generateAssemblyInstructions,
  type AssemblyPlan,
} from '@/app/lib/ai-assembly';

const CELL_SIZE = 0.6;
const FILL_DENSITY = 3;
const GRID_CENTER = 4.5;
const HUB_RADIUS = 2.5;
const HUBS = {
  centralized: new THREE.Vector3(-9, 0.3, 0),
  autonomous: new THREE.Vector3(9, 0.3, 0),
};

function randomHubPosition(center: THREE.Vector3, radius = HUB_RADIUS) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * radius;
  return new THREE.Vector3(
    center.x + Math.cos(angle) * r,
    center.y + Math.random() * 0.2,
    center.z + Math.sin(angle) * r
  );
}
const MODE_LABEL: Record<'centralized' | 'autonomous', string> = {
  centralized: 'Central Controller',
  autonomous: 'Autonomous Swarm',
};

type ShapeKind = 'pyramid' | 'wall';

function parseCommand(command: string): { kind: ShapeKind; params: number[] } {
  const normalized = command.toLowerCase();
  const numbers = normalized.match(/\d+/g)?.map(Number) ?? [];
  if (normalized.includes('wall')) {
    return { kind: 'wall', params: numbers };
  }
  return { kind: 'pyramid', params: numbers };
}

function buildPyramidVoxels(levels = 3): Voxel[] {
  const voxels: Voxel[] = [];
  const clampedLevels = THREE.MathUtils.clamp(levels, 2, 5);

  for (let level = 0; level < clampedLevels; level++) {
    const size = Math.max(1, (clampedLevels - level) * 2 - 1); // Odd widths: 5 -> 3 -> 1
    const start = GRID_CENTER - (size - 1) / 2;

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const x = start + i;
        const z = start + j;
        voxels.push({ x, y: level, z });
      }
    }
  }

  return voxels;
}

function buildWallVoxels(width = 10, height = 4): Voxel[] {
  const voxels: Voxel[] = [];
  const clampedWidth = THREE.MathUtils.clamp(width, 2, 10);
  const clampedHeight = THREE.MathUtils.clamp(height, 2, 6);
  const startX = 5 - Math.floor(clampedWidth / 2);
  const wallZ = 2;

  for (let h = 0; h < clampedHeight; h++) {
    for (let w = 0; w < clampedWidth; w++) {
      voxels.push({
        x: startX + w,
        y: h,
        z: wallZ,
      });
    }
  }

  return voxels;
}

export default function Page() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const swarmRef = useRef<SwarmController | null>(null);
  const autonomousRef = useRef<AutonomousSwarmSystem | null>(null);
  const modeRef = useRef<'centralized' | 'autonomous'>('centralized');
  const centralMeshesRef = useRef<THREE.Group[]>([]);
  const autonomousMeshesRef = useRef<THREE.Group[]>([]);
  const animationRef = useRef<number | null>(null);

  const [status, setStatus] = useState<string>('Idle');
  const [mode, setMode] = useState<'centralized' | 'autonomous'>('centralized');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [lastAssemblyPlan, setLastAssemblyPlan] = useState<AssemblyPlan | null>(null);

  const handleBuild = useCallback(
    (command: string) => {
      if (!swarmRef.current || !autonomousRef.current) return;

      const { kind, params } = parseCommand(command);
      const voxels =
        kind === 'wall'
          ? buildWallVoxels(params[0] ?? 10, params[1] ?? 4)
          : buildPyramidVoxels(params[0] ?? 3);
      const ordered = gravitySortVoxels(voxels);
      const slots = buildSlotsFromVoxels(ordered, CELL_SIZE, FILL_DENSITY);

      const label =
        kind === 'wall'
          ? `${params[0] ?? 10}×${params[1] ?? 4}`
          : `${params[0] ?? 3} levels`;

      const activeMode = modeRef.current;
      setStatus(
        `${MODE_LABEL[activeMode]} assembling ${kind} (${label}) – ${slots.length} slots`
      );

      // Keep both controllers in sync so you can switch modes mid-demo
      swarmRef.current.setSlots(slots);
      autonomousRef.current.setSlots(slots);
    },
    [setStatus]
  );

  const handleScatter = useCallback(() => {
    const activeMode = modeRef.current;
    const label = MODE_LABEL[activeMode];
    setStatus(`Returning ${label.toLowerCase()} to hub...`);

    if (activeMode === 'centralized') {
      swarmRef.current?.scatter();
    } else {
      autonomousRef.current?.scatter();
    }

    setTimeout(() => setStatus('Idle'), 1200);
  }, [setStatus]);

  const handleGenerateAssembly = useCallback(async (command: string) => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    setStatus('Generating component-based assembly plan with Claude...');

    try {
      const plan = await generateAssemblyPlan(command || 'pyramid 6');
      setLastAssemblyPlan(plan);
      
      // Convert to voxels and build
      const voxels = assemblyPlanToVoxels(plan);
      const ordered = gravitySortVoxels(voxels);
      const slots = buildSlotsFromVoxels(ordered, CELL_SIZE);

      const activeMode = modeRef.current;
      swarmRef.current?.setSlots(slots);
      autonomousRef.current?.setSlots(slots);

      setStatus(
        `Generated ${plan.name}: ${plan.components.length} components, ${plan.totalVoxels} voxels`
      );

      // Auto-download the JSON
      setTimeout(() => {
        downloadAssemblyPlan(plan);
        setStatus(`Assembly plan downloaded! Building ${plan.name}...`);
      }, 500);
    } catch (error) {
      console.error('Failed to generate assembly:', error);
      setStatus('Error: Failed to generate assembly plan');
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, setStatus]);

  const handleDownloadLastPlan = useCallback(() => {
    if (!lastAssemblyPlan) {
      setStatus('No assembly plan to download');
      return;
    }
    downloadAssemblyPlan(lastAssemblyPlan);
    setStatus('Assembly plan downloaded!');
  }, [lastAssemblyPlan, setStatus]);

  const handleShowInstructions = useCallback(() => {
    if (!lastAssemblyPlan) {
      setStatus('No assembly plan available');
      return;
    }
    const instructions = generateAssemblyInstructions(lastAssemblyPlan);
    console.log('\n' + '='.repeat(60));
    console.log(instructions);
    console.log('='.repeat(60) + '\n');
    setStatus('Assembly instructions printed to console');
  }, [lastAssemblyPlan, setStatus]);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    containerRef.current.appendChild(renderer.domElement);

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050514);
    scene.fog = new THREE.FogExp2(0x050514, 0.045);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(10, 10, 14);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.update();

    // Lighting setup
    const ambient = new THREE.AmbientLight(0x4f7dff, 0.3);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(10, 20, 10);
    const rim = new THREE.PointLight(0xff6b00, 1.2, 35);
    rim.position.set(-12, 8, -4);
    const depotGlow = new THREE.PointLight(0x4f7dff, 1.6, 18);
    depotGlow.position.set(0, 4, 0);
    scene.add(ambient, dir);
    scene.add(rim, depotGlow);

    // Floor
    const floorGeom = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x050516,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = false;
    scene.add(floor);
    const grid = new THREE.GridHelper(40, 20, 0x1e3a8a, 0x111122);
    grid.position.y = 0.01;
    scene.add(grid);

    // Create two swarms (centralized + autonomous) with their own meshes
    const centralBots: Bot[] = [];
    const autonomousBots: AutonomousBot[] = [];
    const centralMeshes: THREE.Group[] = [];
    const autonomousMeshes: THREE.Group[] = [];
    const numBots = 500;

    for (let i = 0; i < numBots; i++) {
      const meshCentral = createMicrobotMesh();
      meshCentral.position.copy(randomHubPosition(HUBS.centralized));
      meshCentral.visible = modeRef.current === 'centralized';
      scene.add(meshCentral);
      centralBots.push(new Bot(i, meshCentral, meshCentral.position));
      centralMeshes.push(meshCentral);

      const meshAutonomous = createMicrobotMesh();
      meshAutonomous.position.copy(randomHubPosition(HUBS.autonomous));
      meshAutonomous.visible = modeRef.current === 'autonomous';
      scene.add(meshAutonomous);
      autonomousBots.push(new AutonomousBot(i, meshAutonomous));
      autonomousMeshes.push(meshAutonomous);
    }

    centralMeshesRef.current = centralMeshes;
    autonomousMeshesRef.current = autonomousMeshes;

    const swarm = new SwarmController(centralBots, HUBS.centralized, HUB_RADIUS);
    swarmRef.current = swarm;
    const autonomousSwarm = new AutonomousSwarmSystem(autonomousBots, HUBS.autonomous, HUB_RADIUS);
    autonomousRef.current = autonomousSwarm;

    // Animation loop
    let last = performance.now();
    const animate = (time: number) => {
      const dt = (time - last) / 1000;
      last = time;

      if (modeRef.current === 'autonomous') {
        autonomousRef.current?.update(dt);
      } else {
        swarmRef.current?.update(dt);
      }

      controls.update();
      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // Initial shape for the centralized swarm
    handleBuild('pyramid 3');

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      renderer.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [handleBuild]);

  useEffect(() => {
    modeRef.current = mode;

    centralMeshesRef.current.forEach((mesh) => {
      mesh.visible = mode === 'centralized';
    });
    autonomousMeshesRef.current.forEach((mesh) => {
      mesh.visible = mode === 'autonomous';
    });

    if (mode === 'centralized') {
      swarmRef.current?.scatter();
    } else {
      autonomousRef.current?.scatter();
    }

    setStatus(`${MODE_LABEL[mode]} ready. Choose a build command.`);
  }, [mode, setStatus]);

  return (
    <main className="h-screen w-screen flex bg-black text-white overflow-hidden">
      {/* Three.js canvas container */}
      <div ref={containerRef} className="flex-1" />

      {/* UI Panel */}
      <aside className="w-80 p-4 bg-black/70 backdrop-blur border-l border-white/10 flex flex-col gap-4 overflow-y-auto">
        <div>
          <h1 className="text-lg font-semibold">Programmable Matter Swarm</h1>
          <p className="text-xs text-gray-300 mt-1">
            Text-driven self-assembly inspired by <i>Big Hero 6</i>.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wide text-gray-400">
            Mode
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('centralized')}
              className={`px-3 py-2 rounded text-xs font-semibold transition-colors ${
                mode === 'centralized'
                  ? 'bg-blue-500 text-white'
                  : 'bg-black/40 text-gray-400 border border-white/10'
              }`}
            >
              Central Controller
            </button>
            <button
              onClick={() => setMode('autonomous')}
              className={`px-3 py-2 rounded text-xs font-semibold transition-colors ${
                mode === 'autonomous'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-black/40 text-gray-400 border border-white/10'
              }`}
            >
              Autonomous Swarm
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleBuild('pyramid 3')}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded text-sm font-medium transition-colors"
          >
            Build Pyramid
          </button>
          <button
            onClick={() => handleBuild('wall 10x4')}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded text-sm font-medium transition-colors"
          >
            Build Wall
          </button>
          <button
            onClick={handleScatter}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
          >
            Scatter
          </button>
        </div>

        <div className="border-t border-white/10 pt-4">
          <label className="text-xs uppercase tracking-wide text-gray-400 block mb-2">
            🤖 Claude AI Assembly
          </label>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                const input = document.getElementById('commandInput') as HTMLInputElement;
                handleGenerateAssembly(input?.value || 'pyramid 6');
              }}
              disabled={isGenerating}
              className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
            >
              {isGenerating ? 'Generating...' : '✨ Generate Assembly JSON'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadLastPlan}
                disabled={!lastAssemblyPlan}
                className="flex-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
              >
                💾 Download JSON
              </button>
              <button
                onClick={handleShowInstructions}
                disabled={!lastAssemblyPlan}
                className="flex-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors"
              >
                📋 Instructions
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs text-gray-400 block mb-1">Custom Command</label>
          <div className="flex gap-2">
            <input
              id="commandInput"
              type="text"
              className="flex-1 px-2 py-1 text-xs bg-black/50 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder='e.g. "pyramid 3"'
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget;
                  handleBuild(input.value || 'pyramid 3');
                }
              }}
            />
            <button
              onClick={() => {
                const input = document.getElementById('commandInput') as HTMLInputElement;
                handleBuild(input?.value || 'pyramid 3');
              }}
              className="px-2 py-1 text-xs bg-emerald-500 hover:bg-emerald-600 rounded font-medium transition-colors"
            >
              Go
            </button>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-white/10">
          <div className="text-xs text-gray-400">
            Status: <span className="text-gray-100 font-medium">{status}</span>
          </div>
        </div>
      </aside>
    </main>
  );
}
