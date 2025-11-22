// lib/integration-example.ts
// 
// EXAMPLE INTEGRATION FOR TEAMMATES
// 
// This file shows how to wire up the AI + Stigmergy logic
// to the rendering system. Copy this code into your own integration
// file or directly into a script that runs on page load.
//
// The rendering system exposes these window globals:
//   - window.swarmController: SwarmController instance
//   - window.setStatus: (status: string) => void  
//   - window.scene: THREE.Scene
//   - window.shouldAutoRotate: boolean

import { generateShapeFromText } from './ai_shapes';
import type { Vector3 } from './types';

// Define your stigmergy function here
// (Architect should implement this)
export function orderVoxelsBottomUp(voxels: Vector3[]): Vector3[] {
  // TODO: Implement gravity-based sorting
  // For now, just return as-is
  return voxels;
}

// Build handler - wires AI -> Stigmergy -> Swarm
export async function handleBuildClick(command: string) {
  const swarmController = (window as any).swarmController;
  const setStatus = (window as any).setStatus;
  
  if (!swarmController || !setStatus) {
    console.error('Swarm controller or setStatus not available');
    return;
  }

  setStatus('Planning shape with AI...');

  try {
    // 1. Text -> raw voxels (AI generates grid coordinates)
    const raw: Vector3[] = await generateShapeFromText(command);
    
    // 2. Stigmergy: bottom-up build order
    const ordered = orderVoxelsBottomUp(raw);
    
    setStatus(`Assembling: ${command} (${ordered.length} voxels)`);

    // 3. Send to swarm (voxels are already in world coordinates from AI)
    swarmController.setTargets(ordered);
    
    // Optional: Enable auto-rotate when done
    setTimeout(() => {
      const allLocked = swarmController.bots.every((b: any) => b.state === 'locked');
      if (allLocked) {
        (window as any).shouldAutoRotate = true;
      }
    }, 10000); // Check after 10s
    
  } catch (error) {
    console.error('Build error:', error);
    setStatus('Error: Could not build shape');
  }
}

// Scatter handler - resets swarm
export function handleScatterClick() {
  const swarmController = (window as any).swarmController;
  const setStatus = (window as any).setStatus;
  
  if (!swarmController || !setStatus) {
    console.error('Swarm controller or setStatus not available');
    return;
  }

  setStatus('Scattering swarm...');
  (window as any).shouldAutoRotate = false; // Disable auto-rotate
  swarmController.scatter();
  
  setTimeout(() => {
    setStatus('Idle');
  }, 2000);
}

// Call this function to register handlers (run after page loads)
export function registerHandlers() {
  (window as any).handleBuildClick = handleBuildClick;
  (window as any).handleScatterClick = handleScatterClick;
  console.log('Integration handlers registered');
}

