// app/page.tsx
// 
// RENDERING SETUP - Three.js Scene & UI
// 
// This file handles all the Three.js rendering, scene setup, and UI.
// The logic (AI shape generation, stigmergy ordering) is abstracted away.
//
// FOR TEAMMATES: To wire up your logic, implement these window handlers:
//
//   window.handleBuildClick = async (command: string) => {
//     // 1. Generate voxels from text (AI)
//     const voxels = await generateShapeFromText(command);
//     
//     // 2. Order voxels bottom-up (Stigmergy)
//     const ordered = orderVoxelsBottomUp(voxels);
//     
//     // 3. Convert to world positions and set targets
//     const worldPositions = ordered.map(v => ({
//       x: (v.x - 5) * 0.6,  // Adjust cellSize as needed
//       y: 0.3 + v.y * 0.6,
//       z: (v.z - 5) * 0.6,
//     }));
//     
//     // 4. Update status and swarm
//     window.setStatus(`Assembling: ${command} (${ordered.length} voxels)`);
//     window.swarmController.setTargets(worldPositions);
//   };
//
//   window.handleScatterClick = () => {
//     window.setStatus('Scattering swarm...');
//     window.swarmController.scatter();
//   };
//
// Available window globals:
//   - window.swarmController: SwarmController instance
//   - window.setStatus: (status: string) => void
//   - window.scene: THREE.Scene (if you need to add debug objects)
//   - window.shouldAutoRotate: boolean (set to true to enable camera auto-rotate)

'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createMicrobotMesh } from '@/app/lib/microbot';
import { Bot, SwarmController } from '@/app/lib/swarm';
import type { Vector3 } from '@/app/lib/types';

export default function Page() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const swarmRef = useRef<SwarmController | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [status, setStatus] = useState<string>('Idle');

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050514);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(10, 10, 14);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.update();
    controlsRef.current = controls;

    // Lighting setup
    const ambient = new THREE.AmbientLight(0x4f7dff, 0.3);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(10, 20, 10);
    dir.castShadow = false; // Optional: enable if you want shadows later
    scene.add(ambient, dir);

    // Floor
    const floorGeom = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x050516,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = false; // Optional: enable if you want shadows
    scene.add(floor);

    // Create 150 microbots scattered in a pile
    const bots: Bot[] = [];
    const numBots = 150;
    for (let i = 0; i < numBots; i++) {
      const mesh = createMicrobotMesh();
      const x = (Math.random() - 0.5) * 6;
      const z = (Math.random() - 0.5) * 6;
      const y = 0.3 + Math.random() * 0.5; // Slight vertical spread for "pile" effect
      mesh.position.set(x, y, z);
      scene.add(mesh);
      bots.push(new Bot(i, mesh));
    }

    // Initialize swarm controller
    const swarm = new SwarmController(bots);
    swarmRef.current = swarm;

    // Expose swarm and status setter to window for teammates to use
    (window as any).swarmController = swarm;
    (window as any).setStatus = setStatus;
    (window as any).scene = scene;

    // Animation loop
    let last = performance.now();
    const animate = (time: number) => {
      const dt = (time - last) / 1000;
      last = time;

      // Update swarm (handles bot movement)
      swarm.update(dt);

      // Update controls (for damping)
      controls.update();

      // Optional: Auto-rotate camera when structure is complete
      // (Teammates can implement this logic)
      if ((window as any).shouldAutoRotate) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

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

    console.log('Three.js scene ready. Swarm controller available at window.swarmController');

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      // Clean up window references
      delete (window as any).swarmController;
      delete (window as any).setStatus;
      delete (window as any).scene;
      delete (window as any).shouldAutoRotate;
    };
  }, []);

  // UI handlers that call window functions (teammates will implement these)
  const handleBuild = (command: string) => {
    const handler = (window as any).handleBuildClick;
    if (handler) {
      handler(command);
    } else {
      setStatus('Error: Build handler not implemented yet');
      console.warn('window.handleBuildClick not implemented. Teammates should set this up.');
    }
  };

  const handleScatter = () => {
    const handler = (window as any).handleScatterClick;
    if (handler) {
      handler();
    } else {
      setStatus('Error: Scatter handler not implemented yet');
      console.warn('window.handleScatterClick not implemented. Teammates should set this up.');
    }
  };

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
          <button
            onClick={() => handleBuild('pyramid 4')}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded text-sm font-medium transition-colors"
          >
            Build Pyramid
          </button>
          <button
            onClick={() => handleBuild('wall 8x3')}
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

        <div className="mt-4">
          <label className="text-xs text-gray-400 block mb-1">Custom Command</label>
          <div className="flex gap-2">
            <input
              id="commandInput"
              type="text"
              className="flex-1 px-2 py-1 text-xs bg-black/50 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder='e.g. "pyramid 4"'
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget;
                  handleBuild(input.value || 'pyramid 4');
                }
              }}
            />
            <button
              onClick={() => {
                const input = document.getElementById('commandInput') as HTMLInputElement;
                handleBuild(input?.value || 'pyramid 4');
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
