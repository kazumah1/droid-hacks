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
import {
  createComponentVisualizations,
  toggleComponentVisibility,
  type ComponentVisualization,
} from '@/app/lib/component-visualizer';

const CELL_SIZE = 0.6;
const FILL_DENSITY = 1;
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
  const sceneRef = useRef<THREE.Scene | null>(null);
  const swarmRef = useRef<SwarmController | null>(null);
  const autonomousRef = useRef<AutonomousSwarmSystem | null>(null);
  const modeRef = useRef<'centralized' | 'autonomous'>('centralized');
  const centralMeshesRef = useRef<THREE.Group[]>([]);
  const autonomousMeshesRef = useRef<THREE.Group[]>([]);
  const animationRef = useRef<number | null>(null);
  const componentVisualizationsRef = useRef<ComponentVisualization[]>([]);

  const [status, setStatus] = useState<string>('Idle');
  const [mode, setMode] = useState<'centralized' | 'autonomous'>('centralized');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [lastAssemblyPlan, setLastAssemblyPlan] = useState<AssemblyPlan | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showStructure, setShowStructure] = useState<boolean>(false);

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
      
      // Clear previous visualizations
      componentVisualizationsRef.current.forEach(viz => {
        viz.meshes.forEach(mesh => {
          if (sceneRef.current) {
            sceneRef.current.remove(mesh);
          }
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
        });
      });
      componentVisualizationsRef.current = [];

      // Create component visualizations
      if (sceneRef.current) {
        const visualizations = createComponentVisualizations(plan, sceneRef.current, CELL_SIZE);
        componentVisualizationsRef.current = visualizations;
        
        // Show all components
        visualizations.forEach(viz => {
          toggleComponentVisibility(viz, showStructure);
        });
      }
      
      // Convert to voxels and build
      const voxels = assemblyPlanToVoxels(plan);
      const ordered = gravitySortVoxels(voxels);
      const slots = buildSlotsFromVoxels(ordered, CELL_SIZE, FILL_DENSITY);

      const activeMode = modeRef.current;
      swarmRef.current?.setSlots(slots);
      autonomousRef.current?.setSlots(slots);

      setStatus(
        `Generated ${plan.name}: ${plan.components.length} components, ${plan.totalVoxels} voxels`
      );
    } catch (error) {
      console.error('Failed to generate assembly:', error);
      setStatus('Error: Failed to generate assembly plan');
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, setStatus, showStructure]);

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

  const handleLoadJSON = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const plan = JSON.parse(e.target?.result as string) as AssemblyPlan;
        setLastAssemblyPlan(plan);
        
        // Clear previous visualizations
        componentVisualizationsRef.current.forEach(viz => {
          viz.meshes.forEach(mesh => {
            if (sceneRef.current) {
              sceneRef.current.remove(mesh);
            }
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(m => m.dispose());
            } else {
              mesh.material.dispose();
            }
          });
        });
        componentVisualizationsRef.current = [];

        // Create component visualizations
        if (sceneRef.current) {
          const visualizations = createComponentVisualizations(plan, sceneRef.current, CELL_SIZE);
          componentVisualizationsRef.current = visualizations;
          
          // Show all components
          visualizations.forEach(viz => {
            toggleComponentVisibility(viz, showStructure);
          });
        }
        
        // Convert to voxels and build
        const voxels = assemblyPlanToVoxels(plan);
        const ordered = gravitySortVoxels(voxels);
        const slots = buildSlotsFromVoxels(ordered, CELL_SIZE);

        swarmRef.current?.setSlots(slots);
        autonomousRef.current?.setSlots(slots);

        setStatus(
          `Loaded ${plan.name}: ${plan.components.length} components, ${plan.totalVoxels} voxels`
        );
      } catch (error) {
        console.error('Failed to load JSON:', error);
        setStatus('Error: Invalid JSON file format');
      }
    };
    reader.readAsText(file);
    
    // Reset input so the same file can be loaded again
    event.target.value = '';
  }, [showStructure, setStatus]);

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
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.02);
    sceneRef.current = scene;

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
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(10, 20, 10);
    const rimLight = new THREE.DirectionalLight(0xef4444, 0.6);
    rimLight.position.set(-10, 5, -10);
    scene.add(ambient, dir, rimLight);

    // Floor
    const floorGeom = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = false;
    scene.add(floor);
    const grid = new THREE.GridHelper(40, 20, 0xef4444, 0x1a1a1a);
    grid.position.y = 0.01;
    scene.add(grid);

    // Create two swarms (centralized + autonomous) with their own meshes
    const centralBots: Bot[] = [];
    const autonomousBots: AutonomousBot[] = [];
    const centralMeshes: THREE.Group[] = [];
    const autonomousMeshes: THREE.Group[] = [];
    const numBots = 3000;

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
      
      // Clean up component visualizations
      componentVisualizationsRef.current.forEach(viz => {
        viz.meshes.forEach(mesh => {
          scene.remove(mesh);
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
        });
      });
      
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

  useEffect(() => {
    componentVisualizationsRef.current.forEach(viz => {
      toggleComponentVisibility(viz, showStructure);
    });
  }, [showStructure]);

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim()) return;
    
    if (isGenerating) return;

    // Always pass through Claude for AI assembly generation
    handleGenerateAssembly(inputValue);
    
    setInputValue('');
  }, [inputValue, isGenerating, handleGenerateAssembly]);

  return (
    <main className="h-screen w-screen relative overflow-hidden bg-black">
      {/* Three.js canvas container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* App Title */}
      <div className="absolute top-8 left-8 z-10">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Microbots</h1>
        <p className="text-sm text-gray-500 mt-1">AI-Powered Swarm Assembly</p>
      </div>

      {/* Settings Button & Panel */}
      <div className="absolute top-8 right-8 z-10">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-10 h-10 glass-panel flex items-center justify-center hover:border-red-500 transition-all"
          aria-label="Settings"
        >
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            strokeWidth="2"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
            />
          </svg>
        </button>

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute top-14 right-0 w-72 glass-panel p-4">
            <h2 className="text-sm font-semibold text-white mb-4">Control Panel</h2>
            
            {/* Mode Selection */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-2 block">Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('centralized')}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
                    mode === 'centralized'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  Central
                </button>
                <button
                  onClick={() => setMode('autonomous')}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
                    mode === 'autonomous'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  Autonomous
                </button>
              </div>
            </div>

            {/* Blueprint Visibility Toggle */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-2 block">Blueprint</label>
              <button
                onClick={() => setShowStructure(!showStructure)}
                className={`w-full px-3 py-2 text-sm font-medium transition-all ${
                  showStructure
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                }`}
              >
                {showStructure ? 'Hide Blueprint' : 'Show Blueprint'}
              </button>
            </div>

            {/* Actions */}
            <div className="space-y-2 mb-4">
              <button
                onClick={handleScatter}
                className="w-full px-3 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 text-sm transition-all border border-gray-800"
              >
                Scatter Bots
              </button>
              
              <label className="w-full px-3 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 text-sm transition-all border border-gray-800 cursor-pointer flex items-center justify-center">
                Load JSON File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleLoadJSON}
                  className="hidden"
                />
              </label>
              
              {lastAssemblyPlan && (
                <>
                  <button
                    onClick={handleDownloadLastPlan}
                    className="w-full px-3 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 text-sm transition-all border border-gray-800"
                  >
                    Download Plan
                  </button>
                  <button
                    onClick={handleShowInstructions}
                    className="w-full px-3 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 text-sm transition-all border border-gray-800"
                  >
                    Show Instructions
                  </button>
                </>
              )}
            </div>

            {/* Status */}
            <div className="pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-500">
                {status}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Input Bar */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-6 z-10">
        <div className="glass-panel p-3 flex items-center gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit();
              }
            }}
            placeholder="Describe structure (e.g., pyramid 6, bridge, tower)..."
            className="flex-1 px-3 py-2 bg-transparent text-white placeholder-gray-600 focus:outline-none text-sm"
            disabled={isGenerating}
          />
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isGenerating}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-all"
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>
        <p className="text-center text-xs text-gray-600 mt-2">
          Press Enter to generate
        </p>
      </div>
    </main>
  );
}
