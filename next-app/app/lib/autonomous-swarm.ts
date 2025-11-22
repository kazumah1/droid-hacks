// Autonomous Swarm - TRUE stigmergy (no central controller)
// Each bot makes its own decisions based on environmental cues

import * as THREE from 'three';
import { Slot, updateAvailableSlots } from './slots';

export type BotState = 'idle' | 'searching' | 'approaching' | 'locked';

/**
 * Autonomous Bot - makes its own decisions
 * No central controller tells it what to do
 */
export class AutonomousBot {
  id: number;
  mesh: THREE.Group;
  position: THREE.Vector3;
  target: THREE.Vector3;
  state: BotState = 'idle';
  claimedSlotId: number | null = null;
  
  // Autonomous behavior parameters
  searchRadius = 15.0; // How far the bot can "see"
  speed = 8.0; // Movement speed
  
  // Memory (simple cognitive model)
  lastDecisionTime = -Infinity; // Start with immediate first decision
  decisionInterval = 0.1; // Make decisions every 100ms

  constructor(id: number, mesh: THREE.Group) {
    this.id = id;
    this.mesh = mesh;
    this.position = mesh.position.clone();
    this.target = mesh.position.clone();
    this.state = 'idle';
  }

  /**
   * Autonomous decision making - bot decides what to do based on environment
   * This is called each frame, but bot only makes decisions periodically
   */
  think(slots: Slot[], otherBots: AutonomousBot[], currentTime: number) {
    // Don't think too often (cognitive throttling)
    if (currentTime - this.lastDecisionTime < this.decisionInterval) {
      return;
    }
    this.lastDecisionTime = currentTime;

    // If locked in place, don't think
    if (this.state === 'locked') return;

    // If approaching and close to target, lock in
    if (this.state === 'approaching' && this.claimedSlotId !== null) {
      const slot = slots[this.claimedSlotId];
      const dist = this.position.distanceTo(slot.position);
      if (dist < 0.05) {
        this.lockIntoSlot(slot);
        return;
      }
    }

    // Stigmergic search: Look for available slots within sensor range
    const availableSlots = slots.filter(s => s.state === 'available');
    if (availableSlots.length === 0) {
      // No slots available at all - idle and wait
      this.idle();
      return;
    }

    // Check which slots are already claimed by other bots approaching
    const claimedSlotIds = new Set(
      otherBots
        .filter(b => b.id !== this.id && b.state === 'approaching' && b.claimedSlotId !== null)
        .map(b => b.claimedSlotId!)
    );

    // Find nearest unclaimed slot within search radius
    let nearestSlot: Slot | null = null;
    let nearestDist = this.searchRadius;

    for (const slot of availableSlots) {
      if (claimedSlotIds.has(slot.id)) continue;
      
      const dist = this.position.distanceTo(slot.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestSlot = slot;
      }
    }

    // Autonomous decision: claim nearest slot
    if (nearestSlot) {
      this.claimSlot(nearestSlot);
    } else {
      // No slots in range - wander randomly (foraging behavior)
      // Always wander if not already moving toward something
      if (this.state === 'idle' || this.state === 'searching' || 
          this.position.distanceTo(this.target) < 0.5) {
        this.wander();
      }
    }
  }

  /**
   * Move the bot (called every frame)
   */
  move(dt: number) {
    if (this.state === 'locked') return;

    const dist = this.position.distanceTo(this.target);
    
    // Arrival check
    if (dist < 0.05 && this.state !== 'approaching') {
      // Arrived at wander target
      this.state = 'idle';
      return;
    }

    // Move toward target
    const dir = new THREE.Vector3().subVectors(this.target, this.position);
    
    if (dist > 0.001) {
      dir.normalize();
      const moveDist = Math.min(dist, this.speed * dt);
      this.position.add(dir.multiplyScalar(moveDist));
      
      // Sync mesh
      this.mesh.position.copy(this.position);
      
      // Look at target (directional feedback)
      if (dist > 0.1) {
        this.mesh.lookAt(this.target);
      }
    }
  }

  /**
   * Bot claims a slot (stigmergic marker: "I'm going here!")
   */
  private claimSlot(slot: Slot) {
    this.claimedSlotId = slot.id;
    this.target.copy(slot.position);
    this.state = 'approaching';
    this.setBotColor(0x4f7dff); // Blue - active
  }

  /**
   * Bot locks into slot (stigmergic signal: "This slot is filled!")
   */
  private lockIntoSlot(slot: Slot) {
    this.position.copy(slot.position);
    this.mesh.position.copy(this.position);
    this.state = 'locked';
    slot.state = 'filled';
    this.claimedSlotId = null;
    this.setBotColor(0xffaa00); // Orange - locked
  }

  /**
   * Idle behavior - wait for opportunities
   */
  private idle() {
    if (this.state !== 'locked') {
      this.state = 'idle';
    }
  }

  /**
   * Wander randomly (foraging behavior when no slots visible)
   */
  private wander() {
    // Random target within a reasonable range
    const angle = Math.random() * Math.PI * 2;
    const distance = 2 + Math.random() * 4;
    
    this.target.set(
      this.position.x + Math.cos(angle) * distance,
      this.position.y,
      this.position.z + Math.sin(angle) * distance
    );
    
    // Keep within bounds (-10 to +10)
    this.target.x = THREE.MathUtils.clamp(this.target.x, -10, 10);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -10, 10);
    
    this.state = 'searching';
  }

  /**
   * Reset bot to free state
   */
  reset() {
    this.state = 'idle';
    this.claimedSlotId = null;
    this.target.copy(this.position);
    this.setBotColor(0x4f7dff);
  }

  private setBotColor(hex: number) {
    this.mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (child.material.emissive) {
          child.material.emissive.setHex(hex);
          child.material.emissiveIntensity = 1.5;
        }
      }
    });
  }
}

/**
 * Autonomous Swarm System
 * No central coordinator - just provides environment and lets bots decide
 */
export class AutonomousSwarmSystem {
  bots: AutonomousBot[];
  slots: Slot[] = [];
  currentTime = 0;

  constructor(bots: AutonomousBot[]) {
    this.bots = bots;
  }

  /**
   * Set new target structure
   */
  setSlots(slots: Slot[]) {
    this.slots = slots;
    
    // Check for insufficient bots
    if (slots.length > this.bots.length) {
      console.warn(
        `⚠️ Insufficient bots: ${this.bots.length} bots for ${slots.length} slots. ` +
        `${slots.length - this.bots.length} slots will remain empty.`
      );
    }
    
    // Reset all bots
    this.bots.forEach(bot => bot.reset());
  }

  /**
   * Scatter bots randomly
   */
  scatter() {
    this.slots = [];
    this.bots.forEach(bot => {
      bot.position.set(
        (Math.random() - 0.5) * 10,
        0.3 + Math.random() * 0.5,
        (Math.random() - 0.5) * 10
      );
      bot.mesh.position.copy(bot.position);
      bot.reset();
    });
  }

  /**
   * Update loop - each bot thinks and moves autonomously
   */
  update(dt: number) {
    this.currentTime += dt;

    // Phase 1: Each bot makes autonomous decisions (thinking)
    for (const bot of this.bots) {
      bot.think(this.slots, this.bots, this.currentTime);
    }

    // Phase 2: Each bot executes movement (acting)
    for (const bot of this.bots) {
      bot.move(dt);
    }

    // Phase 3: Update environment (stigmergic signaling)
    // When slots are filled, dependent slots become available
    updateAvailableSlots(this.slots);
  }

  /**
   * Get statistics for debugging/visualization
   */
  getStats() {
    const stateCount = {
      idle: 0,
      searching: 0,
      approaching: 0,
      locked: 0,
    };

    for (const bot of this.bots) {
      stateCount[bot.state]++;
    }

    const filledSlots = this.slots.filter(s => s.state === 'filled').length;
    const availableSlots = this.slots.filter(s => s.state === 'available').length;
    const lockedSlots = this.slots.filter(s => s.state === 'locked').length;

    return {
      bots: stateCount,
      slots: {
        total: this.slots.length,
        filled: filledSlots,
        available: availableSlots,
        locked: lockedSlots,
      },
      progress: this.slots.length > 0 ? filledSlots / this.slots.length : 0,
    };
  }
}

