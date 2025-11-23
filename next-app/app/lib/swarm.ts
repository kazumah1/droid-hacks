// Architect – swarm.ts
// Swarm controller with cannon-es physics integration

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Slot, updateAvailableSlots } from './slots';

export type BotState = 'free' | 'movingToSlot' | 'attached' | 'parking';

const BOT_MASS = 0.8;
const BOT_LINEAR_DAMPING = 0.28;
const BOT_STEERING_GAIN = 9.5;
const ACTIVE_SPEED = 9.5;
const MAX_VELOCITY = 16;
const LOCK_THRESHOLD = 0.12;
const FIXED_TIME_STEP = 1 / 180;
const MAX_SUB_STEPS = 8;
const HUB_STACK_RADIUS = 0.6;
const HUB_STACK_HEIGHT = 0.45;
const SURFACE_CELL = 0.6;
const SURFACE_SAMPLE_STEP = SURFACE_CELL * 0.5;
const SURFACE_OFFSET = 0.08;
const CLIMB_APPROACH_RADIUS = 0.45;
const HEIGHT_GAIN = 8;
const MAX_ASCENT_SPEED = 4.2;
const SEPARATION_RADIUS = 0.55;
const SEPARATION_GAIN = 6.5;

export class Bot {
  id: number;
  mesh: THREE.Group;
  body: CANNON.Body;
  position: THREE.Vector3;
  baseTarget: THREE.Vector3;
  baseOrientation: THREE.Quaternion;
  state: BotState = 'free';
  targetSlotId: number | null = null;
  parkingTarget: THREE.Vector3 | null = null;
  stuckTimer = 0;

  constructor(id: number, mesh: THREE.Group, body: CANNON.Body) {
    this.id = id;
    this.mesh = mesh;
    this.body = body;
    this.position = mesh.position.clone();
    this.baseTarget = mesh.position.clone();
    this.baseOrientation = new THREE.Quaternion();
  }

  setColorAttached() {
    this.mesh.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        obj.material.color = new THREE.Color(0xf97316);
        obj.material.emissive = new THREE.Color(0xf97316);
        obj.material.emissiveIntensity = 0.3;
        obj.material.metalness = 0.6;
        obj.material.roughness = 0.4;
      }
      if (obj instanceof THREE.LineSegments && obj.material instanceof THREE.LineBasicMaterial) {
        obj.material.opacity = 0.05;
      }
    });
  }

  setColorFree() {
    this.mesh.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        obj.material.color = new THREE.Color(0x3b82f6);
        obj.material.emissive = new THREE.Color(0x3b82f6);
        obj.material.emissiveIntensity = 0.6;
        obj.material.metalness = 0.5;
        obj.material.roughness = 0.4;
      }
    });
  }
}

export class SwarmController {
  bots: Bot[];
  slots: Slot[] = [];
  speed = ACTIVE_SPEED;
  private world: CANNON.World;
  private forward = new THREE.Vector3(1, 0, 0);
  private tmpDir = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();
  private tmpVec = new THREE.Vector3();
  private tmpSep = new THREE.Vector3();
  private hubCenter: THREE.Vector3;
  private hubRadius: number;
  private surfaceHeights = new Map<string, number>();
  structureOffset = new THREE.Vector3();
  structureOffsetTarget = new THREE.Vector3();
  structureRotation = new THREE.Quaternion();
  structureRotationTarget = new THREE.Quaternion();

  constructor(
    bots: Bot[],
    world: CANNON.World,
    hubCenter = new THREE.Vector3(-8, 0.3, 0),
    hubRadius = 2
  ) {
    this.bots = bots;
    this.world = world;
    this.hubCenter = hubCenter.clone();
    this.hubRadius = hubRadius;
    this.scatter();
  }

  setSlots(slots: Slot[]) {
    this.slots = slots;
    this.resetStructureTransform();
    this.surfaceHeights.clear();
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
      this.setBodyDynamic(bot);
    });

    const n = Math.min(slots.length, this.bots.length);
    for (let i = n; i < this.bots.length; i++) {
      this.parkBot(this.bots[i]);
    }
  }

  scatter() {
    this.slots = [];
    this.resetStructureTransform();
    this.surfaceHeights.clear();
    this.bots.forEach((bot) => this.parkBot(bot, true));
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
      if ((bot.state !== 'free' && bot.state !== 'parking') || bot.targetSlotId !== null) continue;
      let best: Slot | null = null;
      let bestDist = Infinity;
      for (const slot of available) {
        if (targeted.has(slot.id)) continue;
        this.tmpDir.set(
          slot.position.x - bot.body.position.x,
          slot.position.y - bot.body.position.y,
          slot.position.z - bot.body.position.z
        );
        const d = this.tmpDir.lengthSq();
        if (d < bestDist) {
          bestDist = d;
          best = slot;
        }
      }
      if (best) {
        bot.parkingTarget = null;
        bot.targetSlotId = best.id;
        bot.state = 'movingToSlot';
        this.wakeBot(bot);
        targeted.add(best.id);
      }
    }
  }

  update(dt: number) {
    this.structureOffset.lerp(this.structureOffsetTarget, 1 - Math.exp(-dt * 3));
    this.structureRotation.slerp(this.structureRotationTarget, 1 - Math.exp(-dt * 3));

    this.assignTargets();

    for (const bot of this.bots) {
      if (bot.state === 'attached') continue;
      if (bot.state === 'parking') continue;

      if (bot.state === 'movingToSlot' && bot.targetSlotId !== null) {
        const slot = this.slots[bot.targetSlotId];
        if (slot) {
          this.steerBodyTowards(bot, slot.position, dt, 'movingToSlot');
        }
      } else if (bot.state === 'free') {
        this.parkBot(bot);
      }
    }

    this.world.step(FIXED_TIME_STEP, dt, MAX_SUB_STEPS);

    for (const bot of this.bots) {
      if (bot.state === 'attached') {
        this.applyStructureTransform(bot);
        continue;
      }
      bot.position.set(bot.body.position.x, bot.body.position.y, bot.body.position.z);
      bot.mesh.position.copy(bot.position);
      this.alignMesh(bot);
      this.unstickBot(bot, dt);
    }
  }

  private steerBodyTowards(bot: Bot, target: THREE.Vector3, dt: number, intent: BotState) {
    this.setBodyDynamic(bot);
    const bodyPos = bot.body.position;
    const dx = target.x - bodyPos.x;
    const dy = target.y - bodyPos.y;
    const dz = target.z - bodyPos.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (intent === 'movingToSlot' && bot.targetSlotId !== null && distSq < LOCK_THRESHOLD * LOCK_THRESHOLD) {
      const slot = this.slots[bot.targetSlotId];
      if (slot) {
        this.lockBotIntoSlot(bot, slot);
      }
      return;
    }

    if (intent === 'parking' && distSq < 0.04) {
      bot.parkingTarget = this.randomHubPoint();
      return;
    }

    if (distSq < 1e-6) {
      return;
    }

    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    let desiredVelX = 0;
    let desiredVelZ = 0;
    if (horizontalDist > 1e-4) {
      desiredVelX = (dx / horizontalDist) * this.speed;
      desiredVelZ = (dz / horizontalDist) * this.speed;
    }

    const desiredHeight = this.desiredSurfaceHeight(bodyPos, target, horizontalDist);
    const heightError = desiredHeight - bodyPos.y;
    const desiredVelY = THREE.MathUtils.clamp(heightError * HEIGHT_GAIN, -MAX_ASCENT_SPEED, MAX_ASCENT_SPEED);

    const sep = this.computeSeparation(bot);

    const vel = bot.body.velocity;
    vel.x += (desiredVelX + sep.x * SEPARATION_GAIN - vel.x) * BOT_STEERING_GAIN * dt;
    vel.y += (desiredVelY - vel.y) * BOT_STEERING_GAIN * dt;
    vel.z += (desiredVelZ + sep.z * SEPARATION_GAIN - vel.z) * BOT_STEERING_GAIN * dt;
    this.clampVelocity(bot.body);
  }

  private lockBotIntoSlot(bot: Bot, slot: Slot) {
    bot.body.velocity.set(0, 0, 0);
    bot.body.angularVelocity.set(0, 0, 0);
    bot.body.position.set(slot.position.x, slot.position.y, slot.position.z);
    bot.body.type = CANNON.Body.STATIC;
    bot.body.mass = 0;
    bot.body.updateMassProperties();
    bot.body.aabbNeedsUpdate = true;

    bot.state = 'attached';
    bot.targetSlotId = null;
    bot.baseTarget.copy(slot.position);
    bot.baseOrientation.copy(slot.orientation);
    bot.mesh.position.copy(slot.position);
    bot.mesh.quaternion.copy(slot.orientation);
    bot.position.copy(slot.position);
    bot.setColorAttached();
    slot.state = 'filled';
    this.recordSurfaceSlot(slot);
    updateAvailableSlots(this.slots);
  }

  private setBodyDynamic(bot: Bot) {
    if (bot.body.type !== CANNON.Body.DYNAMIC) {
      bot.body.type = CANNON.Body.DYNAMIC;
      bot.body.mass = BOT_MASS;
      bot.body.updateMassProperties();
      bot.body.wakeUp();
    }
    bot.body.linearDamping = BOT_LINEAR_DAMPING;
    bot.body.angularDamping = BOT_LINEAR_DAMPING;
  }

  private applyStructureTransform(bot: Bot) {
    this.tmpVec.copy(bot.baseTarget).applyQuaternion(this.structureRotation).add(this.structureOffset);
    bot.mesh.position.copy(this.tmpVec);
    bot.position.copy(this.tmpVec);
    bot.body.position.set(this.tmpVec.x, this.tmpVec.y, this.tmpVec.z);
    bot.body.aabbNeedsUpdate = true;

    const finalQuat = this.structureRotation.clone().multiply(bot.baseOrientation);
    bot.mesh.quaternion.copy(finalQuat);
  }

  private alignMesh(bot: Bot) {
    const vel = bot.body.velocity;
    const speedSq = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
    if (speedSq < 1e-5) return;
    this.tmpDir.set(vel.x, vel.y, vel.z).normalize();
    this.tmpQuat.setFromUnitVectors(this.forward, this.tmpDir);
    bot.mesh.quaternion.slerp(this.tmpQuat, 0.2);
  }

  private unstickBot(bot: Bot, dt: number) {
    if (bot.state !== 'movingToSlot') {
      bot.stuckTimer = 0;
      return;
    }
    const speedSq = bot.body.velocity.lengthSquared();
    if (speedSq < 0.25) {
      bot.stuckTimer += dt;
      if (bot.stuckTimer > 0.35) {
        bot.body.velocity.y += 1.2;
        bot.body.velocity.x += (Math.random() - 0.5) * 1.2;
        bot.body.velocity.z += (Math.random() - 0.5) * 1.2;
        bot.stuckTimer = 0;
      }
    } else {
      bot.stuckTimer = Math.max(0, bot.stuckTimer - dt);
    }
  }

  private randomHubPoint() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.hubRadius;
    return new THREE.Vector3(
      this.hubCenter.x + Math.cos(angle) * radius,
      this.hubCenter.y + 0.3 + Math.random() * 0.4,
      this.hubCenter.z + Math.sin(angle) * radius
    );
  }

  private recordSurfaceSlot(slot: Slot) {
    const key = this.surfaceKey(slot.position.x, slot.position.z);
    const prev = this.surfaceHeights.get(key);
    if (prev === undefined || slot.position.y > prev) {
      this.surfaceHeights.set(key, slot.position.y);
    }
  }

  private surfaceKey(x: number, z: number) {
    const gx = Math.round(x / SURFACE_CELL);
    const gz = Math.round(z / SURFACE_CELL);
    return `${gx}|${gz}`;
  }

  private surfaceHeightAt(x: number, z: number) {
    let best = 0;
    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        const key = this.surfaceKey(x + ix * SURFACE_SAMPLE_STEP, z + iz * SURFACE_SAMPLE_STEP);
        const h = this.surfaceHeights.get(key);
        if (h !== undefined && h > best) {
          best = h;
        }
      }
    }
    return best;
  }

  private desiredSurfaceHeight(bodyPos: CANNON.Vec3, target: THREE.Vector3, horizontalDist: number) {
    const localSurface = this.surfaceHeightAt(bodyPos.x, bodyPos.z);
    const targetSurface = this.surfaceHeightAt(target.x, target.z);
    let desired = Math.max(localSurface + SURFACE_OFFSET, 0);
    desired = Math.max(desired, targetSurface + SURFACE_OFFSET - 0.15);
    desired = Math.min(desired + 0.35, target.y);
    if (horizontalDist < CLIMB_APPROACH_RADIUS) {
      desired = target.y;
    }
    return desired;
  }

  private computeSeparation(bot: Bot) {
    this.tmpSep.set(0, 0, 0);
    for (const other of this.bots) {
      if (other === bot) continue;
      if (other.state === 'attached' || other.state === 'parking') continue;
      const dx = bot.body.position.x - other.body.position.x;
      const dz = bot.body.position.z - other.body.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < 1e-6 || distSq > SEPARATION_RADIUS * SEPARATION_RADIUS) continue;
      const dist = Math.sqrt(distSq);
      const push = (SEPARATION_RADIUS - dist) / SEPARATION_RADIUS;
      const inv = 1 / dist;
      this.tmpSep.x += dx * inv * push;
      this.tmpSep.z += dz * inv * push;
    }
    return this.tmpSep;
  }

  private parkBot(bot: Bot, snap = false) {
    bot.state = 'parking';
    bot.targetSlotId = null;
    const pilePos = new THREE.Vector3(
      this.hubCenter.x + (Math.random() - 0.5) * HUB_STACK_RADIUS,
      this.hubCenter.y + 0.05 + Math.random() * HUB_STACK_HEIGHT,
      this.hubCenter.z + (Math.random() - 0.5) * HUB_STACK_RADIUS
    );
    bot.parkingTarget = pilePos.clone();
    bot.baseTarget.set(0, 0, 0);
    bot.baseOrientation.identity();
    bot.setColorFree();

    bot.body.type = CANNON.Body.STATIC;
    bot.body.mass = 0;
    bot.body.updateMassProperties();
    bot.body.position.set(pilePos.x, pilePos.y, pilePos.z);
    bot.body.velocity.set(0, 0, 0);
    bot.body.angularVelocity.set(0, 0, 0);
    bot.body.aabbNeedsUpdate = true;

    if (snap) {
      bot.position.copy(pilePos);
      bot.mesh.position.copy(pilePos);
    }
  }

  private clampVelocity(body: CANNON.Body) {
    const vel = body.velocity;
    const speedSq = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
    if (speedSq > MAX_VELOCITY * MAX_VELOCITY) {
      const scale = MAX_VELOCITY / Math.sqrt(speedSq);
      vel.scale(scale, vel);
    }
  }

  private wakeBot(bot: Bot) {
    this.setBodyDynamic(bot);
    bot.body.velocity.y += 0.8;
    bot.body.position.y += 0.02;
  }
}

