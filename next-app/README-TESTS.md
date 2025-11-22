# Unit Tests for Stigmergy System

## Quick Start

```bash
# Install test runner (if not already installed)
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:stigmergy  # Test gravity sorting algorithm
npm run test:slots       # Test slot creation and dependencies
```

## What Gets Tested

### `stigmergy.test.ts` ✅ **NO Three.js Required**
Pure TypeScript logic tests:
- Empty arrays
- Single voxels
- Towers (vertical stacking)
- Pyramids (layer-by-layer)
- Disconnected structures (floating blocks)
- Large structures (stress test)
- Index uniqueness and sequential ordering

### `slots.test.ts` ⚠️ **Uses Mock Three.js**
Tests slot creation and dependency tracking with mocked `THREE.Vector3`:
- Slot creation from voxels
- Prerequisite detection
- Progressive unlocking as slots fill
- Position calculations
- Custom cell sizing
- Independent structure handling

## Test Results

Expected output:
```
🧪 Running Stigmergy Tests...

✅ Empty voxel array returns empty order
✅ Single ground voxel is immediately available
✅ Simple tower: ground then upper blocks
...

✅ Passed: 14
❌ Failed: 0
📊 Total:  14
```

## Why These Tests Matter

1. **No Three.js Setup Required**: Tests run in Node.js without browser/WebGL
2. **Fast Feedback**: ~100ms to validate core logic
3. **Catch Regressions**: Ensure fixes to disconnected structures don't break normal cases
4. **Hackathon-Friendly**: Run tests while Builder sets up Three.js scene

## What's NOT Tested

- `swarm.ts` - Requires full Three.js mocking (Group, Object3D, materials)
- Visual rendering
- Animation timing
- UI interactions

These require integration tests in the browser.

