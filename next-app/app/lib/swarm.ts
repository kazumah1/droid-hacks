// Architect – swarm.ts
// Person C: Bot class and SwarmController for stigmergic assembly

import * as THREE from 'three';
import { Slot, updateAvailableSlots } from './slots';

export type BotState = 'free' | 'movingToSlot' | 'attached';

export class Bot {
  id: number;
  mesh: THREE.Group;
  position: THREE.Vector3;
  state: BotState = 'free';
  targetSlotId: number | null = null;

  constructor(id: number, mesh: THREE.Group, initialPos: THREE.Vector3) {
    this.id = id;
    this.mesh = mesh;
    this.position = initialPos.clone();
    this.mesh.position.copy(this.position);
  }

  setColorAttached() {
    // Change emissive color when attached to indicate filled slot
    this.mesh.traverse((obj: THREE.Object3D) => {
      const m = (obj as any).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'emissive' in m) {
        m.emissive = new THREE.Color(0xf97316); // orange
        m.emissiveIntensity = 1.5;
      }
    });
  }
  
  setColorFree() {
    // Reset to blue emissive when free
    this.mesh.traverse((obj: THREE.Object3D) => {
      const m = (obj as any).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'emissive' in m) {
        m.emissive = new THREE.Color(0x3b82f6); // blue
        m.emissiveIntensity = 1.5;
      }
    });
  }
}

export class SwarmController {
  bots: Bot[];
  slots: Slot[] = [];
  speed = 3; // units/sec

  constructor(bots: Bot[]) {
    this.bots = bots;
  }

  setSlots(slots: Slot[]) {
    this.slots = slots;
    
    // Check for insufficient bots
    if (slots.length > this.bots.length) {
      console.warn(
        `⚠️ Insufficient bots: ${this.bots.length} bots available for ${slots.length} slots. ` +
        `Structure will be incomplete (${slots.length - this.bots.length} slots will remain empty).`
      );
    }
    
    // Reset all bots to free state when new structure is set
    this.bots.forEach(bot => {
      bot.state = 'free';
      bot.targetSlotId = null;
      bot.setColorFree();
    });
  }

  scatter() {
    // Clear structure and scatter bots randomly
    this.slots = [];
    this.bots.forEach(bot => {
      bot.state = 'free';
      bot.targetSlotId = null;
      bot.position.set(
        (Math.random() - 0.5) * 6,
        0.3 + Math.random() * 0.5,
        (Math.random() - 0.5) * 6
      );
      bot.mesh.position.copy(bot.position);
      bot.setColorFree();
    });
  }

  /**
   * Stigmergic assignment: bots autonomously choose nearest available slot.
   * No central coordinator - purely reactive to environment state.
   */
  private assignTargets() {
    const available = this.slots.filter(s => s.state === 'available');
    if (available.length === 0) return;

    // Track which slots are already being targeted to avoid double-assignment
    const targeted = new Set<number>(
      this.bots
        .filter(b => b.state === 'movingToSlot' && b.targetSlotId !== null)
        .map(b => b.targetSlotId!)
    );

    for (const bot of this.bots) {
      if (bot.state !== 'free' || bot.targetSlotId !== null) continue;
      
      // Pick nearest available slot that's not already targeted
      let best: Slot | null = null;
      let bestDist = Infinity;
      for (const slot of available) {
        if (targeted.has(slot.id)) continue; // Skip if another bot is already heading there
        
        const d = bot.position.distanceTo(slot.position);
        if (d < bestDist) {
          bestDist = d;
          best = slot;
        }
      }
      
      if (best) {
        bot.targetSlotId = best.id;
        bot.state = 'movingToSlot';
        targeted.add(best.id); // Mark as targeted to prevent double-assignment
      }
    }
  }

  update(dt: number) {
    // Step 1: Assign free bots to available slots (stigmergic selection)
    this.assignTargets();

    // Step 2: Move bots toward their targets
    for (const bot of this.bots) {
      if (bot.state !== 'movingToSlot' || bot.targetSlotId === null) continue;
      const slot = this.slots[bot.targetSlotId];
      if (!slot) continue;

      const dir = slot.position.clone().sub(bot.position);
      const dist = dir.length();
      
      if (dist < 0.05) {
        // Arrived - attach to slot
        bot.position.copy(slot.position);
        bot.mesh.position.copy(bot.position);
        bot.state = 'attached';
        bot.targetSlotId = null;
        slot.state = 'filled';
        bot.setColorAttached();
        
        // Stigmergic signaling: filling this slot unlocks dependent slots
        updateAvailableSlots(this.slots);
      } else {
        // Move toward slot with speed falloff for smooth arrival
        dir.normalize();
        // Ease out: slower when close for smoother attachment
        const speedFactor = THREE.MathUtils.clamp(dist / 2, 0.3, 1.5);
        const step = this.speed * speedFactor * dt;
        bot.position.addScaledVector(dir, step);
        bot.mesh.position.copy(bot.position);
        
        // Add rotation for visual feedback while moving
        bot.mesh.rotation.y += 2 * dt;
      }
    }
  }
}

