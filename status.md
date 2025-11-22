# Project status log

## 2025-11-22
- Refocused Builder layer on rendering only: `app/page.tsx` now seeds the Three.js scene with lighting, fog, floor grid, and 150 bots, plus local fallback shapes for pyramid/wall builds.
- Removed ad-hoc teammate integration helpers so the UI simply triggers in-place demo builds and scatter behavior.
- Documented the rendering progress in `plan.md` for future coordination; remaining TODO is wiring Architect/Brain modules back in without changing the Builder surface.
- Integrated Architect’s stigmergy + swarm logic: build commands now run through `gravitySortVoxels`/`buildSlotsFromVoxels`, and a UI toggle switches between the centralized `SwarmController` and the autonomous swarm system so we can showcase both behaviors.


