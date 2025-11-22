// lib/swarm.ts
import * as THREE from 'three';
import type { Vector3 } from './types';

export class Bot {
  id: number;
  mesh: THREE.Group;
  // Physical position in the scene
  position: THREE.Vector3;
  // Where the bot WANTS to go
  target: THREE.Vector3;
  state: 'idle' | 'moving' | 'locked';

  constructor(id: number, mesh: THREE.Group) {
    this.id = id;
    this.mesh = mesh;
    this.position = mesh.position.clone();
    this.target = mesh.position.clone();
    this.state = 'idle';
  }
}

export class SwarmController {
  bots: Bot[];
  speed: number = 8.0; // units per second

  constructor(bots: Bot[]) {
    this.bots = bots;
  }

  /**
   * Assigns targets ensuring bots build bottom-up.
   * 'targets' is already sorted by the Stigmergy algo (foundation → roof),
   * so Bot[0] takes the foundation, Bot[N] ends up on top.
   */
  setTargets(targets: Vector3[]) {
    // 1. Scatter any bots we don't need (send them to side "parking lot")
    for (let i = targets.length; i < this.bots.length; i++) {
      this.bots[i].target.set(
        -10 + Math.random() * 2,
        0.3,
        (Math.random() - 0.5) * 10
      );
      this.bots[i].state = 'moving';
      // Reset color to Blue (idle/moving)
      this.setBotColor(this.bots[i], 0x4f7dff);
    }

    // 2. Assign active bots to ordered targets
    const n = Math.min(targets.length, this.bots.length);
    for (let i = 0; i < n; i++) {
      const t = targets[i];
      this.bots[i].target.set(t.x, t.y, t.z);
      this.bots[i].state = 'moving';
      this.setBotColor(this.bots[i], 0x4f7dff);
    }
  }

  /**
   * Scatters all bots to random positions and resets their state.
   * Useful for resetting the swarm after a build.
   */
  scatter() {
    for (const bot of this.bots) {
      bot.state = 'moving';
      bot.target.set(
        (Math.random() - 0.5) * 8,
        0.3 + Math.random() * 0.5,
        (Math.random() - 0.5) * 8
      );
      // Reset color to blue (moving/idle state)
      this.setBotColor(bot, 0x4f7dff);
    }
  }

  update(dt: number) {
    for (const bot of this.bots) {
      if (bot.state === 'locked') continue;

      const dist = bot.position.distanceTo(bot.target);

      // Arrival threshold
      if (dist < 0.05) {
        bot.position.copy(bot.target);
        bot.mesh.position.copy(bot.position);
        bot.state = 'locked';

        // Visual feedback: turn Orange when locked
        this.setBotColor(bot, 0xffaa00);
        continue;
      }

      // Simple P-controller: move towards target
      const dir = new THREE.Vector3()
        .subVectors(bot.target, bot.position)
        .normalize();
      const moveDist = Math.min(dist, this.speed * dt);
      bot.position.add(dir.multiplyScalar(moveDist));

      // Sync mesh
      bot.mesh.position.copy(bot.position);

      // Optional: look at target to make them feel alive
      if (dist > 0.1) {
        bot.mesh.lookAt(bot.target);
      }
    }
  }

  private setBotColor(bot: Bot, hex: number) {
    bot.mesh.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.material instanceof THREE.MeshStandardMaterial
      ) {
        // Only update emissive parts (e.g., the magnet ends)
        if (
          child.material.emissive &&
          (child.material.emissive.r > 0 ||
            child.material.emissive.g > 0 ||
            child.material.emissive.b > 0)
        ) {
          child.material.emissive.setHex(hex);
        }
      }
    });
  }
}
