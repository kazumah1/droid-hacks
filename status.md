# Project status log

## 2025-11-22
- Refocused Builder layer on rendering only: `app/page.tsx` now seeds the Three.js scene with lighting, fog, floor grid, and 150 bots, plus local fallback shapes for pyramid/wall builds.
- Removed ad-hoc teammate integration helpers so the UI simply triggers in-place demo builds and scatter behavior.
- Documented the rendering progress in `plan.md` for future coordination; remaining TODO is wiring Architect/Brain modules back in without changing the Builder surface.
- Integrated Architect’s stigmergy + swarm logic: build commands now run through `gravitySortVoxels`/`buildSlotsFromVoxels`, and a UI toggle switches between the centralized `SwarmController` and the autonomous swarm system so we can showcase both behaviors.
- Reworked swarm controllers to enforce true bottom-up assembly: slots now carry discrete levels, only current levels are released, and new layers unlock once underlying layers report filled, eliminating floating bots.
- Restored rigid-structure transforms (translate/rotate/reset) with smooth interpolation in both centralized and autonomous modes; locked bots follow structureOffset/rotation while movers respect separation + occupancy steering to avoid clipping.
- Added voxel-occupancy collision checks plus cheap avoidance so bots arc around completed geometry instead of phasing through it, improving visual realism during construction.


