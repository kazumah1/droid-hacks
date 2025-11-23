// Autonomous Swarm – decentralized controller driven by cannon-es physics

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Slot, updateAvailableSlots } from './slots';

export type BotState = 'idle' | 'searching' | 'approaching' | 'locked';

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

export class AutonomousBot {
  id: number;
  mesh: THREE.Group;
  body: CANNON.Body;
  position: THREE.Vector3;
  target: THREE.Vector3;
  baseTarget: THREE.Vector3;
  baseOrientation: THREE.Quaternion;
  state: BotState = 'idle';
  claimedSlotId: number | null = null;
  lastDecisionTime = -Infinity;
  decisionInterval = 0.2;
  stuckTimer = 0;
  private forward = new THREE.Vector3(1, 0, 0);
  private tmpDir = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();

  constructor(id: number, mesh: THREE.Group, body: CANNON.Body) {
    this.id = id;
    this.mesh = mesh;
    this.body = body;
    this.position = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
    this.target = this.position.clone();
    this.baseTarget = this.position.clone();
    this.baseOrientation = new THREE.Quaternion();
  }

  syncFromBody() {
    this.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.mesh.position.copy(this.position);
  }

  think(
    slots: Slot[],
    otherBots: AutonomousBot[],
    currentTime: number,
    hubCenter: THREE.Vector3,
    hubRadius: number
  ): Slot | null {
    if (currentTime - this.lastDecisionTime < this.decisionInterval) {
      return null;
    }
    this.lastDecisionTime = currentTime;

    if (this.state === 'locked') return null;

    if (this.state === 'approaching' && this.claimedSlotId !== null) {
      const slot = slots[this.claimedSlotId];
      if (slot) {
      const dist = this.position.distanceTo(slot.position);
        if (dist < LOCK_THRESHOLD) {
        this.lockIntoSlot(slot);
          return slot;
        }
      }
    }

    const availableSlots = slots.filter((s) => s.state === 'available');
    if (availableSlots.length === 0) {
      this.moveToHub(hubCenter, hubRadius);
      return null;
    }

    const claimedSlotIds = new Set(
      otherBots
        .filter((b) => b.id !== this.id && b.state === 'approaching' && b.claimedSlotId !== null)
        .map((b) => b.claimedSlotId!)
    );

    let nearestSlot: Slot | null = null;
    let bestDist = Infinity;
    for (const slot of availableSlots) {
      if (claimedSlotIds.has(slot.id)) continue;
      const dist = this.position.distanceTo(slot.position);
      if (dist < bestDist) {
        bestDist = dist;
        nearestSlot = slot;
      }
    }

    if (nearestSlot) {
      this.claimSlot(nearestSlot);
    } else {
      this.moveToHub(hubCenter, hubRadius);
    }

    return null;
  }

  private claimSlot(slot: Slot) {
    this.claimedSlotId = slot.id;
    this.target.copy(slot.position);
    this.state = 'approaching';
    this.setBotColor(0x3b82f6, 0.6);
  }

  private lockIntoSlot(slot: Slot) {
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.position.set(slot.position.x, slot.position.y, slot.position.z);
    this.body.type = CANNON.Body.STATIC;
    this.body.mass = 0;
    this.body.updateMassProperties();
    this.body.aabbNeedsUpdate = true;

    this.position.copy(slot.position);
    this.mesh.position.copy(slot.position);
    this.mesh.quaternion.copy(slot.orientation);
    this.baseTarget.copy(slot.position);
    this.baseOrientation.copy(slot.orientation);
    this.state = 'locked';
    slot.state = 'filled';
    this.claimedSlotId = null;
    this.setBotColor(0xf97316, 0.3);
  }

  moveToHub(hubCenter: THREE.Vector3, hubRadius: number) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * hubRadius;
    this.target.set(
      hubCenter.x + Math.cos(angle) * radius,
      hubCenter.y + 0.3 + Math.random() * 0.4,
      hubCenter.z + Math.sin(angle) * radius
    );
    this.state = 'searching';
  }

  reset(randomizeTarget = false) {
    this.state = 'idle';
    this.claimedSlotId = null;
    this.baseTarget.set(0, 0, 0);
    this.baseOrientation.identity();
    if (randomizeTarget) {
      this.target.set(
        this.body.position.x + (Math.random() - 0.5) * 2,
        this.body.position.y,
        this.body.position.z + (Math.random() - 0.5) * 2
      );
    } else {
      this.target.set(this.body.position.x, this.body.position.y, this.body.position.z);
    }
    this.setBotColor(0x3b82f6, 0.6);
  }

  alignToVelocity() {
    const vel = this.body.velocity;
    const speedSq = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
    if (speedSq < 1e-5) return;
    this.tmpDir.set(vel.x, vel.y, vel.z).normalize();
    this.tmpQuat.setFromUnitVectors(this.forward, this.tmpDir);
    this.mesh.quaternion.slerp(this.tmpQuat, 0.2);
  }

  private setBotColor(hex: number, emissiveIntensity = 0.6) {
    this.mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.color.setHex(hex);
          child.material.emissive.setHex(hex);
        child.material.emissiveIntensity = emissiveIntensity;
        child.material.metalness = 0.5;
        child.material.roughness = 0.4;
        }
      if (child instanceof THREE.LineSegments && child.material instanceof THREE.LineBasicMaterial) {
        child.material.opacity = emissiveIntensity < 0.5 ? 0.05 : child.material.opacity;
      }
    });
  }
}

export class AutonomousSwarmSystem {
  bots: AutonomousBot[];
  slots: Slot[] = [];
  currentTime = 0;
  private world: CANNON.World;
  private hubCenter: THREE.Vector3;
  private hubRadius: number;
  private tmpVec = new THREE.Vector3();
  private tmpSep = new THREE.Vector3();
  private surfaceHeights = new Map<string, number>();
  structureOffset = new THREE.Vector3();
  structureOffsetTarget = new THREE.Vector3();
  structureRotation = new THREE.Quaternion();
  structureRotationTarget = new THREE.Quaternion();

  constructor(
    bots: AutonomousBot[],
    world: CANNON.World,
    hubCenter = new THREE.Vector3(8, 0.3, 0),
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
    
    this.bots.forEach((bot) => this.parkBot(bot, true));
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

  update(dt: number) {
    this.currentTime += dt;
    this.structureOffset.lerp(this.structureOffsetTarget, 1 - Math.exp(-dt * 3));
    this.structureRotation.slerp(this.structureRotationTarget, 1 - Math.exp(-dt * 3));

    this.bots.forEach((bot) => bot.syncFromBody());

    let needsAvailabilityUpdate = false;
    for (const bot of this.bots) {
      const lockedSlot = bot.think(this.slots, this.bots, this.currentTime, this.hubCenter, this.hubRadius);
      if (lockedSlot) {
        needsAvailabilityUpdate = true;
        this.recordSurfaceSlot(lockedSlot);
      }
      if (bot.state === 'approaching') {
        this.wakeBot(bot);
      }
    }

    if (needsAvailabilityUpdate) {
      updateAvailableSlots(this.slots);
    }

    for (const bot of this.bots) {
      if (bot.state === 'locked') continue;

      if ((bot.state === 'idle' || bot.state === 'searching') && bot.body.type !== CANNON.Body.STATIC) {
        this.parkBot(bot);
        continue;
      }

      if (bot.state === 'approaching' && bot.claimedSlotId !== null) {
        const slot = this.slots[bot.claimedSlotId];
        if (slot) {
          this.steerBodyTowards(bot, slot.position, dt, true);
          continue;
        }
      }

      if (bot.state === 'searching') {
        this.parkBot(bot);
      }
    }

    this.world.step(FIXED_TIME_STEP, dt, MAX_SUB_STEPS);

    for (const bot of this.bots) {
      if (bot.state === 'locked') {
        this.applyStructureTransform(bot);
      } else {
        bot.position.set(bot.body.position.x, bot.body.position.y, bot.body.position.z);
        bot.mesh.position.copy(bot.position);
        bot.alignToVelocity();
        this.unstickBot(bot, dt);
      }
    }
  }

  private steerBodyTowards(bot: AutonomousBot, target: THREE.Vector3, dt: number, lockingIntent: boolean) {
    this.setBodyDynamic(bot);
    const bodyPos = bot.body.position;
    const dx = target.x - bodyPos.x;
    const dz = target.z - bodyPos.z;
    const distSq = dx * dx + (target.y - bodyPos.y) * (target.y - bodyPos.y) + dz * dz;

    if (lockingIntent && distSq < LOCK_THRESHOLD * LOCK_THRESHOLD && bot.claimedSlotId !== null) {
      const slot = this.slots[bot.claimedSlotId];
      if (slot) {
        bot.lockIntoSlot(slot);
        this.recordSurfaceSlot(slot);
        updateAvailableSlots(this.slots);
      }
      return;
    }

    if (distSq < 1e-6) return;

    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    const horizontalSpeed = this.speedFor(bot);
    let desiredVelX = 0;
    let desiredVelZ = 0;
    if (horizontalDist > 1e-4) {
      desiredVelX = (dx / horizontalDist) * horizontalSpeed;
      desiredVelZ = (dz / horizontalDist) * horizontalSpeed;
    }

    const desiredHeight = this.desiredSurfaceHeight(bot.body.position, target, horizontalDist);
    const heightError = desiredHeight - bot.body.position.y;
    const desiredVelY = THREE.MathUtils.clamp(heightError * HEIGHT_GAIN, -MAX_ASCENT_SPEED, MAX_ASCENT_SPEED);

    const sep = this.computeSeparation(bot);

    const vel = bot.body.velocity;
    vel.x += (desiredVelX + sep.x * SEPARATION_GAIN - vel.x) * BOT_STEERING_GAIN * dt;
    vel.y += (desiredVelY - vel.y) * BOT_STEERING_GAIN * dt;
    vel.z += (desiredVelZ + sep.z * SEPARATION_GAIN - vel.z) * BOT_STEERING_GAIN * dt;
    this.clampVelocity(bot.body);
    this.enforceSurfaceLeash(bot, horizontalDist, lockingIntent);
  }

  private speedFor(bot: AutonomousBot) {
    return bot.state === 'approaching' ? ACTIVE_SPEED : ACTIVE_SPEED * 0.65;
  }

  private setBodyDynamic(bot: AutonomousBot) {
    if (bot.body.type !== CANNON.Body.DYNAMIC) {
      bot.body.type = CANNON.Body.DYNAMIC;
      bot.body.mass = BOT_MASS;
      bot.body.updateMassProperties();
      bot.body.wakeUp();
    }
    bot.body.linearDamping = BOT_LINEAR_DAMPING;
    bot.body.angularDamping = BOT_LINEAR_DAMPING;
  }

  private applyStructureTransform(bot: AutonomousBot) {
    this.tmpVec.copy(bot.baseTarget).applyQuaternion(this.structureRotation).add(this.structureOffset);
    bot.mesh.position.copy(this.tmpVec);
    bot.position.copy(this.tmpVec);
    bot.body.position.set(this.tmpVec.x, this.tmpVec.y, this.tmpVec.z);
    bot.body.aabbNeedsUpdate = true;
    const finalQuat = this.structureRotation.clone().multiply(bot.baseOrientation);
    bot.mesh.quaternion.copy(finalQuat);
  }

  private wakeBot(bot: AutonomousBot) {
    this.setBodyDynamic(bot);
    if (bot.body.velocity.y > 0) {
      bot.body.velocity.y = 0;
    }
    bot.body.position.y = Math.max(bot.body.position.y, SURFACE_OFFSET);
  }

  private unstickBot(bot: AutonomousBot, dt: number) {
    if (bot.state !== 'approaching') {
      bot.stuckTimer = 0;
      return;
    }
    const speedSq = bot.body.velocity.lengthSquared();
    if (speedSq < 0.25) {
      bot.stuckTimer += dt;
      if (bot.stuckTimer > 0.35) {
        bot.body.velocity.y += 1.1;
        bot.body.velocity.x += (Math.random() - 0.5) * 1.2;
        bot.body.velocity.z += (Math.random() - 0.5) * 1.2;
        bot.stuckTimer = 0;
      }
    } else {
      bot.stuckTimer = Math.max(0, bot.stuckTimer - dt);
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

  private randomHubPoint() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.hubRadius;
    return new THREE.Vector3(
      this.hubCenter.x + Math.cos(angle) * radius,
      this.hubCenter.y + 0.3 + Math.random() * 0.4,
      this.hubCenter.z + Math.sin(angle) * radius
    );
  }

  private parkBot(bot: AutonomousBot, snap = false) {
    bot.state = 'idle';
    bot.claimedSlotId = null;
    const pilePos = new THREE.Vector3(
      this.hubCenter.x + (Math.random() - 0.5) * HUB_STACK_RADIUS,
      this.hubCenter.y + 0.05 + Math.random() * HUB_STACK_HEIGHT,
      this.hubCenter.z + (Math.random() - 0.5) * HUB_STACK_RADIUS
    );
    bot.baseTarget.set(0, 0, 0);
    bot.baseOrientation.identity();
    bot.target.copy(pilePos);
    bot.setBotColor(0x3b82f6, 0.6);

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

  private desiredSurfaceHeight(
    pos: CANNON.Vec3,
    target: THREE.Vector3,
    horizontalDist: number
  ) {
    const localSurface = this.surfaceHeightAt(pos.x, pos.z);
    const targetSurface = this.surfaceHeightAt(target.x, target.z);
    let desired = Math.max(localSurface + SURFACE_OFFSET, 0);
    desired = Math.max(desired, targetSurface + SURFACE_OFFSET - 0.15);
    desired = Math.min(desired + 0.35, target.y);
    if (horizontalDist < CLIMB_APPROACH_RADIUS) {
      desired = target.y;
    }
    return desired;
  }

  private enforceSurfaceLeash(bot: AutonomousBot, horizontalDist: number, lockingIntent: boolean) {
    if (lockingIntent && horizontalDist < CLIMB_APPROACH_RADIUS) {
      return;
    }
    const bodyPos = bot.body.position;
    const localSurface = this.surfaceHeightAt(bodyPos.x, bodyPos.z);
    const leashHeight = localSurface + SURFACE_OFFSET + 0.35;
    if (bodyPos.y > leashHeight) {
      bodyPos.y = THREE.MathUtils.lerp(bodyPos.y, leashHeight, 0.7);
      if (bot.body.velocity.y > 0) {
        bot.body.velocity.y *= 0.2;
      }
    }
  }

  private computeSeparation(bot: AutonomousBot) {
    this.tmpSep.set(0, 0, 0);
    for (const other of this.bots) {
      if (other === bot) continue;
      if (other.state === 'locked' || other.state === 'idle' || other.state === 'searching') continue;
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

    const filledSlots = this.slots.filter((s) => s.state === 'filled').length;
    const availableSlots = this.slots.filter((s) => s.state === 'available').length;
    const lockedSlots = this.slots.filter((s) => s.state === 'locked').length;

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

