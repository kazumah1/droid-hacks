// Architect – swarm.ts
// Person C: Bot class and SwarmController for stigmergic assembly

import * as THREE from 'three';
import { Slot, updateAvailableSlots } from './slots';

export type BotState = 'free' | 'movingToSlot' | 'attached' | 'parking';

export class Bot {
  id: number;
  mesh: THREE.Group;
  position: THREE.Vector3;
  state: BotState = 'free';
  targetSlotId: number | null = null;
  parkingTarget: THREE.Vector3 | null = null;

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
  private forward = new THREE.Vector3(1, 0, 0);
  private tmpDir = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();
  private hubCenter: THREE.Vector3;
  private hubRadius: number;

  constructor(bots: Bot[], hubCenter = new THREE.Vector3(-8, 0.3, 0), hubRadius = 2) {
    this.bots = bots;
    this.hubCenter = hubCenter.clone();
    this.hubRadius = hubRadius;
    this.scatter();
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
      bot.parkingTarget = null;
      bot.setColorFree();
    });

    const n = Math.min(slots.length, this.bots.length);
    for (let i = n; i < this.bots.length; i++) {
      this.parkBot(this.bots[i]);
    }
  }

  scatter() {
    // Clear structure and scatter bots randomly
    this.slots = [];
    this.bots.forEach(bot => {
      this.parkBot(bot, true);
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
        bot.parkingTarget = null;
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
      if (bot.state === 'parking') {
        this.updateParking(bot, dt);
        continue;
      }

      if (bot.state !== 'movingToSlot' || bot.targetSlotId === null) continue;
      const slot = this.slots[bot.targetSlotId];
      if (!slot) continue;

      const dir = this.tmpDir.copy(slot.position).sub(bot.position);
      const dist = dir.length();
      
      if (dist < 0.05) {
        // Arrived - attach to slot
        bot.position.copy(slot.position);
        bot.mesh.position.copy(bot.position);
        this.alignMesh(bot, slot, dist, dir);
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
        this.alignMesh(bot, slot, dist, dir);
      }
    }
  }

  private alignMesh(bot: Bot, slot: Slot | null, dist: number, dir: THREE.Vector3) {
    const hasDir = dir.lengthSq() > 1e-6;
    if (hasDir) {
      this.tmpQuat.setFromUnitVectors(this.forward, dir.clone().normalize());
      bot.mesh.quaternion.slerp(this.tmpQuat, 0.2);
    }

    if (slot && dist < 0.15) {
      bot.mesh.quaternion.slerp(slot.orientation, 0.35);
    }
  }

  private updateParking(bot: Bot, dt: number) {
    if (!bot.parkingTarget) {
      bot.parkingTarget = this.randomHubPoint();
    }
    const dir = this.tmpDir.copy(bot.parkingTarget).sub(bot.position);
    const dist = dir.length();
    if (dist < 0.05) {
      bot.position.copy(bot.parkingTarget);
      bot.mesh.position.copy(bot.position);
      bot.parkingTarget = null;
      return;
    }
    dir.normalize();
    const step = this.speed * 0.8 * dt;
    bot.position.addScaledVector(dir, step);
    bot.mesh.position.copy(bot.position);
    this.alignMesh(bot, null, dist, dir);
  }

  private randomHubPoint() {
    return new THREE.Vector3(
      this.hubCenter.x + (Math.random() - 0.5) * 2 * this.hubRadius,
      this.hubCenter.y + Math.random() * 0.3,
      this.hubCenter.z + (Math.random() - 0.5) * 2 * this.hubRadius
    );
  }

  private parkBot(bot: Bot, snap = false) {
    bot.state = 'parking';
    bot.targetSlotId = null;
    bot.parkingTarget = this.randomHubPoint();
    bot.setColorFree();
    if (snap) {
      bot.position.copy(bot.parkingTarget);
      bot.mesh.position.copy(bot.position);
    }
  }
}

