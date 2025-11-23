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
  searchRadius = 50.0; // How far the bot can "see" (increased for 0-49 grid)
  speed = 80.0; // Movement speed (MUCH faster assembly)
  
  // Collision avoidance parameters
  collisionRadius = 0.8; // Minimum safe distance from other bots
  separationForce = 5.0; // Strength of repulsion from nearby bots
  avoidanceRadius = 2.0; // Distance at which to start avoiding other bots
  
  // Memory (simple cognitive model)
  lastDecisionTime = -Infinity; // Start with immediate first decision
  decisionInterval = 0.1; // Make decisions every 100ms
  private forward = new THREE.Vector3(1, 0, 0);
  private tmpDir = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();

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
  think(
    slots: Slot[],
    otherBots: AutonomousBot[],
    currentTime: number,
    hubCenter?: THREE.Vector3,
    hubRadius?: number
  ) {
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
      if (dist < 0.1) {
        this.lockIntoSlot(slot);
        return;
      }
    }

    // Stigmergic search: Look for available slots within sensor range
    const availableSlots = slots.filter(s => s.state === 'available');
    if (availableSlots.length === 0) {
      // No slots available - go idle
      this.state = 'idle';
      this.claimedSlotId = null;
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
    let nearestDist = Infinity;

    for (const slot of availableSlots) {
      if (claimedSlotIds.has(slot.id)) continue;
      
      const dist = this.position.distanceTo(slot.position);
      // Only consider slots within search radius
      if (dist <= this.searchRadius && dist < nearestDist) {
        nearestDist = dist;
        nearestSlot = slot;
      }
    }

    // Autonomous decision: claim nearest slot
    if (nearestSlot) {
      this.claimSlot(nearestSlot);
    } else {
      this.moveToHub(hubCenter, hubRadius);
    }
  }

  /**
   * Calculate separation force from nearby bots (collision avoidance)
   */
  private calculateSeparation(otherBots: AutonomousBot[], toTarget: THREE.Vector3): THREE.Vector3 {
    const separation = new THREE.Vector3();
    let neighborCount = 0;

    for (const other of otherBots) {
      if (other.id === this.id) continue;
      
      const distance = this.position.distanceTo(other.position);
      
      // Apply repulsion force from nearby bots
      if (distance < this.avoidanceRadius && distance > 0.001) {
        const repulsion = new THREE.Vector3()
          .subVectors(this.position, other.position);
        
        // If other bot is locked, it won't move, so use stronger avoidance
        const strengthMultiplier = other.state === 'locked' ? 1.2 : 1.0;
        
        repulsion.normalize().multiplyScalar(
          (this.separationForce / distance) * strengthMultiplier
        );
        
        // Bias avoidance perpendicular to target direction to maintain forward progress
        // This ensures we go "around" rather than "backwards"
        const forwardComponent = repulsion.dot(toTarget);
        if (forwardComponent < -0.5) {
          // If repulsion is pushing us backwards, redirect it perpendicular
          const perpendicular = new THREE.Vector3(-toTarget.z, 0, toTarget.x);
          if (repulsion.dot(perpendicular) < 0) {
            perpendicular.negate();
          }
          repulsion.copy(perpendicular).multiplyScalar(this.separationForce / distance);
        }
        
        separation.add(repulsion);
        neighborCount++;
      }
    }

    if (neighborCount > 0) {
      separation.divideScalar(neighborCount);
    }

    return separation;
  }

  /**
   * Check if the path to target is blocked by another bot
   */
  private isPathBlocked(otherBots: AutonomousBot[]): boolean {
    const toTarget = new THREE.Vector3().subVectors(this.target, this.position);
    const targetDist = toTarget.length();
    
    if (targetDist < 0.001) return false;
    
    toTarget.normalize();

    for (const other of otherBots) {
      if (other.id === this.id) continue;
      
      const toOther = new THREE.Vector3().subVectors(other.position, this.position);
      const distToOther = toOther.length();
      
      if (distToOther < 0.001) continue;
      
      // Check if other bot is roughly in our path
      const projection = toOther.dot(toTarget);
      
      if (projection > 0 && projection < targetDist) {
        // Other bot is ahead of us
        const perpDist = toOther.clone().sub(toTarget.clone().multiplyScalar(projection)).length();
        
        // If bot is in our way (within collision radius)
        if (perpDist < this.collisionRadius) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Move the bot (called every frame) with collision avoidance
   */
  move(dt: number, slotOrientation?: THREE.Quaternion, otherBots: AutonomousBot[] = []) {
    if (this.state === 'locked') return;

    const dist = this.position.distanceTo(this.target);
    
    // Arrival check
    if (dist < 0.1 && this.state !== 'approaching') {
      // Arrived at wander target
      this.state = 'idle';
      return;
    }

    // Calculate desired direction toward target
    const desiredDir = new THREE.Vector3().subVectors(this.target, this.position);
    
    if (dist > 0.001) {
      desiredDir.normalize();
      
      let finalDir = desiredDir.clone();
      
      // Only apply collision avoidance when approaching assembly slots
      // This prevents lag from O(n²) checks when bots are idle in the hub
      if (this.state === 'approaching') {
        // Filter to only check collision with other approaching bots and locked bots
        const relevantBots = otherBots.filter(b => 
          b.id !== this.id && (b.state === 'approaching' || b.state === 'locked')
        );
        
        // Calculate separation force from other bots (pass target direction for smarter avoidance)
        const separation = this.calculateSeparation(relevantBots, desiredDir);
        const separationStrength = separation.length();
        
        // Adaptive blending: stronger avoidance when very close, but still make progress
        let avoidanceWeight = 0.3; // Default weight for avoidance
        
        if (separationStrength > 0.001) {
          // Check if path is blocked
          if (this.isPathBlocked(relevantBots)) {
            avoidanceWeight = 0.6; // Increase avoidance when blocked
          }
          
          separation.normalize();
        }
        
        // Blend desired direction with avoidance
        finalDir = desiredDir.clone().multiplyScalar(1.0 - avoidanceWeight)
          .add(separation.multiplyScalar(avoidanceWeight));
        
        // Normalize final direction
        if (finalDir.lengthSq() > 0.001) {
          finalDir.normalize();
        } else {
          finalDir.copy(desiredDir); // Fallback to desired direction
        }
      }
      
      // Move with collision avoidance (or simple movement if idle/searching)
      const moveDist = Math.min(dist, this.speed * dt);
      this.position.add(finalDir.multiplyScalar(moveDist));
      
      // Sync mesh
      this.mesh.position.copy(this.position);
      
      // Align with motion or slot orientation near arrival
      this.alignMesh(slotOrientation, dist);
    }
  }

  /**
   * Bot claims a slot (stigmergic marker: "I'm going here!")
   */
  private claimSlot(slot: Slot) {
    this.claimedSlotId = slot.id;
    this.target.copy(slot.position);
    this.state = 'approaching';
    this.setBotColor(0x3b82f6, 0.6); // Blue - active
  }

  /**
   * Bot locks into slot (stigmergic signal: "This slot is filled!")
   */
  private lockIntoSlot(slot: Slot) {
    this.position.copy(slot.position);
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.copy(slot.orientation); // Perfect alignment
    this.state = 'locked';
    slot.state = 'filled';
    this.claimedSlotId = null;
    this.setBotColor(0xf97316, 0.3); // Orange - locked
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

  private moveToHub(hubCenter?: THREE.Vector3, hubRadius = 2) {
    if (!hubCenter) {
      this.wander();
      return;
    }
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * hubRadius;
    this.target.set(
      hubCenter.x + Math.cos(angle) * radius,
      hubCenter.y + Math.random() * 0.2,
      hubCenter.z + Math.sin(angle) * radius
    );
    this.state = 'searching';
  }

  /**
   * Reset bot to free state
   */
  reset() {
    this.state = 'idle';
    this.claimedSlotId = null;
    this.target.copy(this.position);
    this.setBotColor(0x3b82f6, 0.6);
  }

  private alignMesh(slotOrientation?: THREE.Quaternion, dist?: number) {
    if (slotOrientation && dist !== undefined && dist < 0.15) {
      this.mesh.quaternion.slerp(slotOrientation, 0.35);
      return;
    }

    const dir = this.tmpDir.copy(this.target).sub(this.position);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    this.tmpQuat.setFromUnitVectors(this.forward, dir);
    this.mesh.quaternion.slerp(this.tmpQuat, 0.2);
  }

  private setBotColor(hex: number, emissiveIntensity = 0.6) {
    this.mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (child.material.emissive) {
          child.material.color.setHex(hex);
          child.material.emissive.setHex(hex);
          child.material.emissiveIntensity = emissiveIntensity;
          child.material.metalness = 0.5;
          child.material.roughness = 0.4;
        }
      }
      // Reduce edge opacity for assembled cubes
      if ((child as any).isLineSegments && emissiveIntensity < 0.5) {
        const line = child as THREE.LineSegments;
        const lineMat = line.material as THREE.LineBasicMaterial;
        if (lineMat) {
          lineMat.opacity = 0.05;
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
  private hubCenter: THREE.Vector3;
  private hubRadius: number;

  constructor(bots: AutonomousBot[], hubCenter = new THREE.Vector3(8, 0.3, 0), hubRadius = 2, autoScatter = true) {
    this.bots = bots;
    this.hubCenter = hubCenter.clone();
    this.hubRadius = hubRadius;
    if (autoScatter) {
      this.scatter();
    }
  }

  /**
   * Set new target structure
   */
  setSlots(slots: Slot[]) {
    this.slots = slots;
    
    console.log(`[AutonomousSwarm] Received ${slots.length} slots for ${this.bots.length} bots`);
    
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
      const pos = this.randomHubPoint();
      bot.position.copy(pos);
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
      bot.think(this.slots, this.bots, this.currentTime, this.hubCenter, this.hubRadius);
    }

    // Phase 2: Each bot executes movement (acting) with collision avoidance
    // Note: Collision checks are optimized - only 'approaching' bots check for collisions
    // This prevents O(n²) lag when many bots are idle in the hub
    for (const bot of this.bots) {
      const slotOrientation =
        bot.state === 'approaching' && bot.claimedSlotId !== null
          ? this.slots[bot.claimedSlotId]?.orientation
          : undefined;
      bot.move(dt, slotOrientation, this.bots);
    }

    // Phase 3: Update environment (stigmergic signaling)
    // When slots are filled, dependent slots become available
    updateAvailableSlots(this.slots);
  }

  private randomHubPoint() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.hubRadius;
    return new THREE.Vector3(
      this.hubCenter.x + Math.cos(angle) * radius,
      this.hubCenter.y + Math.random() * 0.2,
      this.hubCenter.z + Math.sin(angle) * radius
    );
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

