# Project status log

## 2025-11-22
- Refocused Builder layer on rendering only: `app/page.tsx` now seeds the Three.js scene with lighting, fog, floor grid, and 150 bots, plus local fallback shapes for pyramid/wall builds.
- Removed ad-hoc teammate integration helpers so the UI simply triggers in-place demo builds and scatter behavior.
- Documented the rendering progress in `plan.md` for future coordination; remaining TODO is wiring Architect/Brain modules back in without changing the Builder surface.
- Integrated Architect’s stigmergy + swarm logic: build commands now run through `gravitySortVoxels`/`buildSlotsFromVoxels`, and a UI toggle switches between the centralized `SwarmController` and the autonomous swarm system so we can showcase both behaviors.
- Reworked swarm controllers to enforce true bottom-up assembly: slots now carry discrete levels, only current levels are released, and new layers unlock once underlying layers report filled, eliminating floating bots.
- Restored rigid-structure transforms (translate/rotate/reset) with smooth interpolation in both centralized and autonomous modes; locked bots follow structureOffset/rotation while movers respect separation + occupancy steering to avoid clipping.
- Added voxel-occupancy collision checks plus cheap avoidance so bots arc around completed geometry instead of phasing through it, improving visual realism during construction.

## 2025-11-23
- Integrated cannon-es physics so each swarm mode runs inside its own physics world; bots now have rigid bodies, collide realistically, and lock into structures as static obstacles.
- Locked bots remain transformable for blueprint “nudge/rotate” actions by driving their static bodies with the blueprint offset, while movers steer via physics velocities toward stigmergic targets.
- Reduced spawn counts and added lint/test updates to reflect the new pipeline; the UI still presents the same commands but now benefits from grounded motion.
- Follow-up tuning pass: bots now track a sampled surface-height field so they slide across the floor/structure, larger colliders stop visual overlap, higher friction keeps them glued to surfaces, and hub piles stay frozen until a bot is explicitly awakened.
- Mirrored the sliding logic into the autonomous swarm and added a “surface leash”, preventing that mode’s bots from free-floating while still allowing them to climb once the lateral distance to a slot collapses.
- Added separation steering + low-friction bot↔bot contacts so movers glide around each other before the physics solver has to resolve a collision, eliminating the visible clipping/jamming when many blue bots crowd the same corridor.
