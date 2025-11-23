Nice, this outline is actually solid. Let’s flesh it out into something you can almost code line‑by‑line, keeping your roles and 4‑hour window in mind.

I’ll stick to:

* **Next.js + TS + Three.js** (client‑only)
* **OpenAI API** for “Brain”
* **Stigmergy pipeline** = Text → Voxels → Gravity‑sorted slots → Swarm controller

I’ll annotate which person touches which file.

---

## Builder progress — 2025-11-22

- Three.js scene now stands on its own: `app/page.tsx` spins up the renderer, lights, fog, grid, floor plane, and 150 microbots without relying on Brain/Architect hooks.
- UI buttons (`Build Pyramid`, `Build Wall`, custom input, `Scatter`) directly call into the swarm controller so the rendering demo works end-to-end even before the other modules are wired up.
- Added cinematic polish (dual point lights, ambient fill, grid helper, camera damping) plus a default pyramid build trigger so the view never feels empty.
- Teammate-specific helpers and window globals were stripped out; this document now tracks how the Builder layer behaves so the other roles can integrate against a clean surface later.
- Integrated Architect teammate’s logic: commands now flow through `gravitySortVoxels` → `buildSlotsFromVoxels`, and the UI can toggle between the centralized `SwarmController` and the new `AutonomousSwarmSystem` to compare behaviors.
- Reinforced stigmergic realism: slots now carry discrete levels, controllers only release the next layer when the one below is filled, and locked bots ride a global transform so we can translate/rotate entire builds without breaking alignment.

---

## Project file structure

```txt
/app
  page.tsx           ← Builder + Architect wire this up
/lib
  microbot.ts        ← Builder
  swarm.ts           ← Architect
  slots.ts           ← Architect
  stigmergy.ts       ← Architect
  ai_shapes.ts       ← Brain
```

---

## Hour 0:00 – 0:30 — Setup & Synchronization (All Hands)

**Goal:** Next app runs, Three.js renders a black screen, “Ready” logs.

1. `npx create-next-app@latest` (TS, App Router).
2. Install deps:

```bash
npm install three
npm install --save-dev @types/three
npm install openai
# (optional) framer-motion / tailwind if you really want
```

3. Add `.env.local`:

```env
OPENAI_API_KEY=sk-...
```

4. Create the `/lib` files (empty exports) so imports don’t break.

5. Make `/app/page.tsx` a client component with a bare Three.js scene.

### Minimal `/app/page.tsx` skeleton

```tsx
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function Page() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(10, 10, 14);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();

    console.log('Ready');

    const animate = (time: number) => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    requestAnimationFrame(animate);

    return () => {
      renderer.dispose();
    };
  }, []);

  return (
    <main className="h-screen w-screen flex bg-black text-white">
      <div ref={containerRef} className="flex-1" />
      <aside className="w-80 p-4 border-l border-white/10">
        {/* UI panel goes here */}
      </aside>
    </main>
  );
}
```

---

## Hour 0:30 – 2:00 — The Sprint (Divide & Conquer)

### 🎨 Person A – Builder: Visuals (Three.js, UI)

**Goal:** 150 nice‑looking microbots in a pile on the floor.

#### `/lib/microbot.ts`

```ts
// Builder
import * as THREE from 'three';

export function createMicrobotMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body
  const bodyGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12);
  const bodyMat = new THREE.MeshStandardMaterial({
    metalness: 0.8,
    roughness: 0.3,
    color: 0xaaaaaa,
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.rotation.z = Math.PI / 2;
  group.add(body);

  // Ends (magnets)
  const endGeom = new THREE.SphereGeometry(0.16, 16, 16);
  const endMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: 0x3b82f6,
    emissiveIntensity: 1.5,
  });
  const left = new THREE.Mesh(endGeom, endMat);
  const right = new THREE.Mesh(endGeom, endMat);
  left.position.set(-0.3, 0, 0);
  right.position.set(0.3, 0, 0);
  group.add(left, right);

  return group;
}
```

#### Update `page.tsx` to show bots + floor

```tsx
// in useEffect, after scene/camera/init:
import { createMicrobotMesh } from '../lib/microbot';
import { Bot, SwarmController } from '../lib/swarm'; // Architect will fill this

// Lights
const ambient = new THREE.AmbientLight(0x4f7dff, 0.3);
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(10, 20, 10);
scene.add(ambient, dir);

// Floor
const floorGeom = new THREE.PlaneGeometry(40, 40);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x050516,
  roughness: 0.9,
});
const floor = new THREE.Mesh(floorGeom, floorMat);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Create bots
const bots: Bot[] = [];
const numBots = 150;
for (let i = 0; i < numBots; i++) {
  const mesh = createMicrobotMesh();
  const x = (Math.random() - 0.5) * 6;
  const z = (Math.random() - 0.5) * 6;
  const y = 0.3 + Math.random() * 0.5;
  mesh.position.set(x, y, z);
  scene.add(mesh);
  bots.push(new Bot(i, mesh, mesh.position));
}

// Swarm (Architect will implement)
const swarm = new SwarmController(bots);

// animation loop
let last = performance.now();
const animate = (time: number) => {
  const dt = (time - last) / 1000;
  last = time;
  requestAnimationFrame(animate);

  swarm.update(dt); // no-op at first
  renderer.render(scene, camera);
};
requestAnimationFrame(animate);
```

UI panel scaffolding (Builder) – basic buttons:

```tsx
<aside className="w-80 p-4 bg-black/70 backdrop-blur border-l border-white/10 flex flex-col gap-4">
  <h1 className="text-lg font-semibold">Programmable Matter Swarm</h1>
  <p className="text-xs text-gray-300">
    Text-driven self-assembly inspired by <i>Big Hero 6</i>.
  </p>

  <button
    onClick={() => (window as any).handleBuildClick?.('pyramid 4')}
    className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded text-sm font-medium"
  >
    Build Pyramid
  </button>

  <button
    onClick={() => (window as any).handleScatterClick?.()}
    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium"
  >
    Scatter
  </button>

  <div className="mt-4">
    <label className="text-xs text-gray-400">Command</label>
    <div className="flex gap-2 mt-1">
      <input
        id="commandInput"
        className="flex-1 px-2 py-1 text-xs bg-black/50 border border-gray-700 rounded"
        placeholder='e.g. "pyramid 4"'
      />
      <button
        onClick={() => {
          const el = document.getElementById('commandInput') as HTMLInputElement | null;
          const cmd = el?.value || '';
          (window as any).handleBuildClick?.(cmd);
        }}
        className="px-2 py-1 text-xs bg-emerald-500 hover:bg-emerald-600 rounded"
      >
        Go
      </button>
    </div>
  </div>

  <div id="status" className="text-xs text-gray-400 mt-auto"></div>
</aside>
```

---

### 🧠 Person B – Brain: AI Bridge (`lib/ai_shapes.ts`)

**Goal:** Text prompt → **array of voxels** (x, y, z) within a small grid.
We’ll let the AI decide the shape, but you can also “cheat” by requesting something very constrained.

```ts
// lib/ai_shapes.ts – Brain
import OpenAI from 'openai';

export interface Voxel {
  x: number;
  y: number;
  z: number;
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are a shape generator for a programmable matter simulator.

The world is a 3D voxel grid with x, y, z coordinates ranging from 0 to 9 (inclusive).
Given a short natural language command (like "pyramid 4" or "wall 6x3"),
you must respond with a JSON object ONLY, with this shape:

{
  "voxels": [
    {"x": 0, "y": 0, "z": 0},
    ...
  ]
}

Rules:
- voxels must form a single connected structure.
- do not exceed a 10x10x10 grid (0–9).
- y=0 is the ground.
- For a pyramid N, produce a stepped pyramid with N levels.
- For a wall W x H, produce a vertical wall with width and height.
- Never include any extra keys or commentary, only the JSON object.
`;

export async function generateShapeFromText(command: string): Promise<Voxel[]> {
  // Simple fallback: small 3x3x3 pyramid if AI fails
  const fallback: Voxel[] = [];
  for (let y = 0; y < 3; y++) {
    const size = 3 - y;
    const offset = Math.floor((3 - size) / 2);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        fallback.push({ x: offset + i, y, z: offset + j });
      }
    }
  }

  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4.1-mini', // or whatever is available
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: command },
      ],
      temperature: 0,
    });

    const text = res.choices[0].message.content ?? '';
    // Try to parse JSON from the response
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return fallback;
    const json = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const voxels = (json.voxels || []) as Voxel[];

    // sanitize / clamp
    return voxels
      .filter(v => v && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number')
      .map(v => ({
        x: Math.max(0, Math.min(9, Math.round(v.x))),
        y: Math.max(0, Math.min(9, Math.round(v.y))),
        z: Math.max(0, Math.min(9, Math.round(v.z))),
      }));
  } catch (e) {
    console.error('AI shape error', e);
    return fallback;
  }
}
```

You can test this quickly by calling it from a temporary button in `page.tsx` and logging the output.

---

### 📐 Person C – Architect: Stigmergy + Swarm Controller

**Goal:** Turn voxels into a **physically plausible build order** and drive the bots.

We’ll do:

1. `Voxel` → **gravity‑sorted list** (ground blocks first, upper blocks later).
2. That into **Slots** with dependencies.
3. Swarm controller uses Slots to assemble in order.

#### `/lib/stigmergy.ts` – gravity / frontier algorithm

```ts
// Architect – lib/stigmergy.ts
import { Voxel } from './ai_shapes';

export interface OrderedVoxel extends Voxel {
  index: number;
}

/**
 * Gravity / frontier sort:
 * - y=0 can be placed anytime (grounded).
 * - A voxel at (x,y,z) with y>0 can only be placed after a voxel exists at (x,y-1,z).
 */
export function gravitySortVoxels(voxels: Voxel[]): OrderedVoxel[] {
  const remaining = new Map<string, Voxel>();
  const key = (v: Voxel) => `${v.x},${v.y},${v.z}`;

  voxels.forEach(v => remaining.set(key(v), v));

  const placed = new Map<string, OrderedVoxel>();
  const order: OrderedVoxel[] = [];

  let idx = 0;
  while (remaining.size > 0) {
    const frontier: [string, Voxel][] = [];

    for (const [k, v] of remaining.entries()) {
      if (v.y === 0) {
        frontier.push([k, v]);
        continue;
      }
      const belowKey = `${v.x},${v.y - 1},${v.z}`;
      if (placed.has(belowKey)) {
        frontier.push([k, v]);
      }
    }

    if (frontier.length === 0) {
      console.warn('No gravity-consistent frontier; falling back to arbitrary order.');
      // break out to prevent infinite loop
      for (const [k, v] of remaining.entries()) {
        frontier.push([k, v]);
      }
    }

    for (const [k, v] of frontier) {
      remaining.delete(k);
      const ov: OrderedVoxel = { ...v, index: idx++ };
      placed.set(k, ov);
      order.push(ov);
    }
  }

  return order;
}
```

#### `/lib/slots.ts` – from ordered voxels to slots (dependencies)

```ts
// Architect – lib/slots.ts
import * as THREE from 'three';
import { OrderedVoxel } from './stigmergy';

export type SlotState = 'locked' | 'available' | 'filled';

export interface Slot {
  id: number;
  position: THREE.Vector3;
  prereqIds: number[];
  state: SlotState;
}

export function buildSlotsFromVoxels(ordered: OrderedVoxel[], cellSize = 0.6): Slot[] {
  const slots: Slot[] = [];
  const keyToId = new Map<string, number>();
  const key = (v: { x: number; y: number; z: number }) => `${v.x},${v.y},${v.z}`;

  ordered.forEach((v, idx) => {
    const pos = new THREE.Vector3(
      (v.x - 5) * cellSize,         // center around origin
      0.3 + v.y * cellSize,
      (v.z - 5) * cellSize,
    );

    const slot: Slot = {
      id: idx,
      position: pos,
      prereqIds: [],
      state: 'locked',
    };
    slots.push(slot);
    keyToId.set(key(v), idx);
  });

  // add prereqs based on "gravity"
  slots.forEach((slot, idx) => {
    const v = ordered[idx];
    if (v.y > 0) {
      const belowKey = `${v.x},${v.y - 1},${v.z}`;
      const belowId = keyToId.get(belowKey);
      if (belowId !== undefined) {
        slot.prereqIds.push(belowId);
      }
    }
  });

  // base layer and any slot with satisfied prereqs become available
  updateAvailableSlots(slots);

  return slots;
}

export function updateAvailableSlots(slots: Slot[]) {
  for (const slot of slots) {
    if (slot.state !== 'locked') continue;
    if (slot.prereqIds.length === 0) {
      slot.state = 'available';
      continue;
    }
    const ready = slot.prereqIds.every(id => slots[id].state === 'filled');
    if (ready) slot.state = 'available';
  }
}
```

#### `/lib/swarm.ts` – bots + stigmergic assembly

```ts
// Architect – lib/swarm.ts
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
    // optional: change emissive when attached
    this.mesh.traverse(obj => {
      const m = (obj as any).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'emissive' in m) {
        m.emissive = new THREE.Color(0xf97316); // orange
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
    this.bots.forEach(bot => {
      bot.state = 'free';
      bot.targetSlotId = null;
    });
  }

  scatter() {
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
    });
  }

  private assignTargets() {
    const available = this.slots.filter(s => s.state === 'available');
    if (available.length === 0) return;

    for (const bot of this.bots) {
      if (bot.state !== 'free' || bot.targetSlotId !== null) continue;
      // pick nearest available slot
      let best: Slot | null = null;
      let bestDist = Infinity;
      for (const slot of available) {
        const d = bot.position.distanceTo(slot.position);
        if (d < bestDist) {
          bestDist = d;
          best = slot;
        }
      }
      if (best) {
        bot.targetSlotId = best.id;
        bot.state = 'movingToSlot';
      }
    }
  }

  update(dt: number) {
    // step 1: assign free bots to available slots
    this.assignTargets();

    // step 2: move bots
    for (const bot of this.bots) {
      if (bot.state !== 'movingToSlot' || bot.targetSlotId === null) continue;
      const slot = this.slots[bot.targetSlotId];
      if (!slot) continue;

      const dir = slot.position.clone().sub(bot.position);
      const dist = dir.length();
      if (dist < 0.05) {
        // attach
        bot.position.copy(slot.position);
        bot.mesh.position.copy(bot.position);
        bot.state = 'attached';
        bot.targetSlotId = null;
        slot.state = 'filled';
        bot.setColorAttached();
        // update dependent slots
        updateAvailableSlots(this.slots);
      } else {
        dir.normalize();
        // ease out: slower when close
        const speedFactor = THREE.MathUtils.clamp(dist / 2, 0.3, 1.5);
        const step = this.speed * speedFactor * dt;
        bot.position.addScaledVector(dir, step);
        bot.mesh.position.copy(bot.position);
        bot.mesh.rotation.y += 2 * dt;
      }
    }
  }
}
```

---

## Hour 2:00 – 3:00 — Integration (“Danger Zone”)

Now connect it all:

In `page.tsx` `useEffect` (where you already created `swarm` and `bots`), wire the global handlers so UI can call into the pipeline.

```tsx
import { generateShapeFromText } from '../lib/ai_shapes';
import { gravitySortVoxels } from '../lib/stigmergy';
import { buildSlotsFromVoxels } from '../lib/slots';

// ... after swarm is created:

(window as any).handleScatterClick = () => {
  swarm.scatter();
  const status = document.getElementById('status');
  if (status) status.textContent = 'Status: scattered.';
};

(window as any).handleBuildClick = async (command: string) => {
  const status = document.getElementById('status');
  if (status) status.textContent = 'Status: generating shape...';

  const voxels = await generateShapeFromText(command || 'pyramid 3');
  const ordered = gravitySortVoxels(voxels);
  const slots = buildSlotsFromVoxels(ordered, 0.6);

  swarm.setSlots(slots);

  if (status) {
    status.textContent = `Status: assembling ${command || 'pyramid'} with ${
      slots.length
    } slots.`;
  }
};
```

The animation loop is already calling `swarm.update(dt)`, so after `handleBuildClick` runs, you should see bots start self‑assembling.

Tune:

* `speed` in `SwarmController`.
* distance thresholds.
* number of voxels (AI prompt or fallback).

---

## Hour 3:00 – 4:00 — Wow Factor & Polish

You already planned:

* **Dynamic speed** – done via `speedFactor` in `SwarmController`.
* **Color cues** – `setColorAttached()` flips emissive to orange when attached.
* **Camera auto‑rotate** – enable `controls.autoRotate = true` once enough slots are filled.

Example: after each `update`, if `slots.length > 0` and all `slots.state === 'filled'`, you can set:

```ts
if (slots.length > 0 && slots.every(s => s.state === 'filled')) {
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
}
```

(Just make sure `controls` is accessible in that scope.)

---

## Demo Script (tight 60–90 seconds)

While one teammate clicks:

1. **Intro (10–15s)**
   “We built a simulation of text‑driven programmable matter: 150 micro‑agents that assemble into structures like a pyramid using stigmergic rules.”

2. **Explain pipeline (20–30s)**
   “When I type a command like ‘pyramid 4’, our AI module turns that into a voxel blueprint. Our stigmergy engine then computes a gravity‑respecting construction order — which blocks have to be placed first. We treat those as ‘slots’ in the environment.”

3. **Live Build (20–25s)**
   (Click Build Pyramid.)

   “The bots aren’t assigned individual coordinates. They simply look for available construction slots, move there, and attach. As each slot is filled, it unlocks new slots above it, so the pyramid grows from the ground up.”

4. **Reset & Future (15–20s)**
   (Click Scatter.)

   “We can clear the structure, send the swarm back into a depot, and then reprogram the system with a different command or blueprint. This is a toy version of programmable matter: text‑to‑structure, verified by simulation, executed by a swarm.”

---

That should give each of you very concrete code to start from, while still fitting inside a 4‑hour sprint with a functional and impressive demo.
