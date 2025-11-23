// Architect – swarm.ts
// Person C: Bot class and SwarmController for stigmergic assembly

import * as THREE from 'three';
import { Slot, updateAvailableSlots } from './slots';

export type BotState = 'free' | 'movingToSlot' | 'attached' | 'parking';

const BOT_RADIUS = 0.35;
const SEPARATION_WEIGHT = 1.2;
const LOOKAHEAD_DISTANCE = 1.6;
const OCCUPANCY_CELL = 0.3;

export class Bot {
  id: number;
  mesh: THREE.Group;
  position: THREE.Vector3;
  baseTarget: THREE.Vector3;
  baseOrientation: THREE.Quaternion;
  state: BotState = 'free';
  targetSlotId: number | null = null;
  parkingTarget: THREE.Vector3 | null = null;

  constructor(id: number, mesh: THREE.Group, initialPos: THREE.Vector3) {
    this.id = id;
    this.mesh = mesh;
    this.position = initialPos.clone();
    this.baseTarget = initialPos.clone();
    this.baseOrientation = new THREE.Quaternion();
    this.mesh.position.copy(this.position);
  }

  setColorAttached() {
    this.mesh.traverse((obj: THREE.Object3D) => {
      if ((obj as any).isMesh) {
        const mesh = obj as THREE.Mesh;
        const m = mesh.material as THREE.MeshStandardMaterial;
        if (m && 'emissive' in m) {
          m.color = new THREE.Color(0xf97316);
          m.emissive = new THREE.Color(0xf97316);
          m.emissiveIntensity = 0.3;
          m.metalness = 0.6;
          m.roughness = 0.4;
        }
      }
      if ((obj as any).isLineSegments) {
        const line = obj as THREE.LineSegments;
        const lineMat = line.material as THREE.LineBasicMaterial;
        if (lineMat) {
          lineMat.opacity = 0.05;
        }
      }
    });
  }

  setColorFree() {
    this.mesh.traverse((obj: THREE.Object3D) => {
      if ((obj as any).isMesh) {
        const mesh = obj as THREE.Mesh;
        const m = mesh.material as THREE.MeshStandardMaterial;
        if (m && 'emissive' in m) {
          m.color = new THREE.Color(0x3b82f6);
          m.emissive = new THREE.Color(0x3b82f6);
          m.emissiveIntensity = 0.6;
          m.metalness = 0.5;
          m.roughness = 0.4;
        }
      }
    });
  }
}

export class SwarmController {
  bots: Bot[];
  slots: Slot[] = [];
  speed = 5;
  private forward = new THREE.Vector3(1, 0, 0);
  private tmpDir = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();
  private tmpVec = new THREE.Vector3();
  private tmpSep = new THREE.Vector3();
  private tmpOffset = new THREE.Vector3();
  private tmpAhead = new THREE.Vector3();
  private tmpLateral = new THREE.Vector3();
  private tmpMoveDir = new THREE.Vector3();
  private hubCenter: THREE.Vector3;
  private hubRadius: number;
  private occupiedVoxels = new Set<string>();
  structureOffset = new THREE.Vector3();
  structureOffsetTarget = new THREE.Vector3();
  structureRotation = new THREE.Quaternion();
  structureRotationTarget = new THREE.Quaternion();

  constructor(bots: Bot[], hubCenter = new THREE.Vector3(-8, 0.3, 0), hubRadius = 2) {
    this.bots = bots;
    this.hubCenter = hubCenter.clone();
    this.hubRadius = hubRadius;
    this.scatter();
  }

  setSlots(slots: Slot[]) {
    this.slots = slots;
    this.resetStructureTransform();
    this.occupiedVoxels.clear();
    updateAvailableSlots(this.slots);

    if (slots.length > this.bots.length) {
      console.warn(
        `⚠️ Insufficient bots: ${this.bots.length} bots available for ${slots.length} slots. ` +
          `Structure will be incomplete (${slots.length - this.bots.length} slots will remain empty).`
      );
    }

    this.bots.forEach((bot) => {
      bot.state = 'free';
      bot.targetSlotId = null;
      bot.parkingTarget = null;
      bot.baseTarget.set(0, 0, 0);
      bot.baseOrientation.identity();
      bot.setColorFree();
    });

    const n = Math.min(slots.length, this.bots.length);
    for (let i = n; i < this.bots.length; i++) {
      this.parkBot(this.bots[i]);
    }
  }

  scatter() {
    this.slots = [];
    this.resetStructureTransform();
    this.occupiedVoxels.clear();
    this.bots.forEach((bot) => {
      this.parkBot(bot, true);
    });
  }

  translateStructure(dx: number, dy: number, dz: number) {
    this.tmpVec.set(dx, dy, dz);
    this.structureOffsetTarget.add(this.tmpVec);
  }

  rotateStructureY(angleRad: number) {
    const q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleRad);
    this.structureRotationTarget.premultiply(q);
  }

  resetStructureTransform() {
    this.structureOffset.set(0, 0, 0);
    this.structureOffsetTarget.set(0, 0, 0);
    this.structureRotation.identity();
    this.structureRotationTarget.identity();
  }

  private assignTargets() {
    const available = this.slots.filter((s) => s.state === 'available');
    if (available.length === 0) return;

    const targeted = new Set<number>(
      this.bots.filter((b) => b.state === 'movingToSlot' && b.targetSlotId !== null).map((b) => b.targetSlotId!)
    );

    for (const bot of this.bots) {
      if (bot.state !== 'free' || bot.targetSlotId !== null) continue;
      let best: Slot | null = null;
      let bestDist = Infinity;
      for (const slot of available) {
        if (targeted.has(slot.id)) continue;
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
        targeted.add(best.id);
      }
    }
  }

  update(dt: number) {
    this.structureOffset.lerp(this.structureOffsetTarget, 1 - Math.exp(-dt * 3));
    this.structureRotation.slerp(this.structureRotationTarget, 1 - Math.exp(-dt * 3));

    this.assignTargets();

    for (const bot of this.bots) {
      if (bot.state === 'attached') {
        this.applyStructureTransform(bot);
        continue;
      }

      if (bot.state === 'parking') {
        this.updateParking(bot, dt);
        continue;
      }

      if (bot.state !== 'movingToSlot' || bot.targetSlotId === null) continue;
      const slot = this.slots[bot.targetSlotId];
      if (!slot) continue;

      const desiredDir = this.tmpDir.copy(slot.position).sub(bot.position);
      const dist = desiredDir.length();

      if (dist < 0.1) {
        bot.position.copy(slot.position);
        bot.mesh.position.copy(bot.position);
        bot.mesh.quaternion.copy(slot.orientation);
        bot.state = 'attached';
        bot.targetSlotId = null;
        slot.state = 'filled';
        bot.baseTarget.copy(slot.position);
        bot.baseOrientation.copy(slot.orientation);
        bot.setColorAttached();
        this.markVoxelOccupied(slot.position);
        updateAvailableSlots(this.slots);
        continue;
      }

      desiredDir.normalize();
      const separation = this.computeSeparationForce(bot);
      this.tmpMoveDir.copy(desiredDir);
      if (separation.lengthSq() > 1e-4) {
        separation.multiplyScalar(SEPARATION_WEIGHT);
        this.tmpMoveDir.add(separation).normalize();
      }
      if (this.isBlockedAhead(bot, this.tmpMoveDir)) {
        this.tmpMoveDir.y += 0.8;
        this.tmpMoveDir.normalize();
      }

      const speedFactor = THREE.MathUtils.clamp(dist / 2, 0.4, 1.8);
      const step = this.speed * speedFactor * dt;

      if (!this.pathIntersectsStructure(bot.position, this.tmpMoveDir, step)) {
        bot.position.addScaledVector(this.tmpMoveDir, step);
      } else {
        this.tmpMoveDir.y += 1.0;
        this.tmpMoveDir.normalize();
        if (!this.pathIntersectsStructure(bot.position, this.tmpMoveDir, step)) {
          bot.position.addScaledVector(this.tmpMoveDir, step);
        }
      }

      bot.mesh.position.copy(bot.position);
      this.alignMesh(bot, slot, dist, this.tmpMoveDir);
    }
  }

  private applyStructureTransform(bot: Bot) {
    this.tmpVec.copy(bot.baseTarget).applyQuaternion(this.structureRotation).add(this.structureOffset);
    bot.mesh.position.copy(this.tmpVec);
    const finalQuat = this.structureRotation.clone().multiply(bot.baseOrientation);
    bot.mesh.quaternion.copy(finalQuat);
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
    if (dist < 0.1) {
      bot.position.copy(bot.parkingTarget);
      bot.mesh.position.copy(bot.position);
      bot.parkingTarget = null;
      return;
    }
    dir.normalize();
    const step = this.speed * 1.2 * dt;
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
    bot.baseTarget.set(0, 0, 0);
    bot.baseOrientation.identity();
    bot.setColorFree();
    if (snap) {
      bot.position.copy(bot.parkingTarget);
      bot.mesh.position.copy(bot.position);
    }
  }

  private computeSeparationForce(bot: Bot): THREE.Vector3 {
    this.tmpSep.set(0, 0, 0);
    for (const other of this.bots) {
      if (other === bot) continue;
      this.tmpOffset.copy(bot.position).sub(other.position);
      const d = this.tmpOffset.length();
      const minDist = BOT_RADIUS * 2;
      if (d <= 0 || d >= minDist) continue;
      const strength = (minDist - d) / minDist;
      this.tmpSep.add(this.tmpOffset.normalize().multiplyScalar(strength));
    }
    return this.tmpSep;
  }

  private isBlockedAhead(bot: Bot, moveDir: THREE.Vector3): boolean {
    for (const other of this.bots) {
      if (other === bot || other.state !== 'attached') continue;
      this.tmpAhead.copy(other.mesh.position).sub(bot.position);
      const proj = this.tmpAhead.dot(moveDir);
      if (proj <= 0 || proj > LOOKAHEAD_DISTANCE) continue;
      this.tmpOffset.copy(moveDir).multiplyScalar(proj);
      this.tmpLateral.copy(this.tmpAhead).sub(this.tmpOffset);
      if (this.tmpLateral.length() < BOT_RADIUS * 1.5) {
        return true;
      }
    }
    return false;
  }

  private markVoxelOccupied(pos: THREE.Vector3) {
    this.occupiedVoxels.add(this.voxelKey(pos));
  }

  private voxelKey(pos: THREE.Vector3): string {
    return `${Math.round(pos.x / OCCUPANCY_CELL)},${Math.round(pos.y / OCCUPANCY_CELL)},${Math.round(
      pos.z / OCCUPANCY_CELL
    )}`;
  }

  private pathIntersectsStructure(start: THREE.Vector3, dir: THREE.Vector3, distance: number): boolean {
    if (distance <= 0) return false;
    const steps = Math.max(2, Math.ceil(distance / OCCUPANCY_CELL));
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * distance;
      this.tmpVec.copy(start).addScaledVector(dir, t);
      const key = this.voxelKey(this.tmpVec);
      if (this.occupiedVoxels.has(key)) {
        return true;
      }
    }
    return false;
  }
}

