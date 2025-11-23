# Collision Avoidance Implementation

## Overview

Implemented a collision avoidance system for the autonomous swarm assembly that allows multiple microrobots to move simultaneously toward their target positions while avoiding collisions with each other.

## Implementation Details

### 1. Collision Detection

**Method**: `isPathBlocked(otherBots: AutonomousBot[])`

- Checks if another bot is in the current bot's path to its target
- Uses vector projection to determine if a bot is along the trajectory
- Calculates perpendicular distance to detect if the bot is within the collision radius

### 2. Separation Force

**Method**: `calculateSeparation(otherBots: AutonomousBot[], toTarget: THREE.Vector3)`

- Applies repulsive force from nearby bots within the avoidance radius
- Stronger repulsion when bots are closer (inverse distance relationship)
- Enhanced avoidance for locked (stationary) bots
- Smart perpendicular redirection: When repulsion would push backwards, the force is redirected perpendicular to maintain forward progress

### 3. Adaptive Avoidance Steering

**Enhanced `move()` method**:

- Blends desired direction toward target with separation force
- Adaptive weighting: 30% avoidance by default, 60% when path is blocked
- Ensures bots can still make progress while avoiding collisions
- Maintains smooth motion and orientation alignment

## Parameters

```typescript
collisionRadius = 0.8;    // Minimum safe distance (units)
separationForce = 5.0;    // Strength of repulsion
avoidanceRadius = 2.0;    // Distance to start avoiding
```

These parameters are tuned to balance:
- Safety: Preventing collisions
- Efficiency: Allowing bots to pass reasonably close
- Progress: Ensuring bots reach their targets

## Key Features

1. **Real-time collision avoidance**: Each bot independently avoids others during movement
2. **Forward progress bias**: Bots navigate around obstacles rather than retreating
3. **Locked bot awareness**: Stronger avoidance for stationary assembled bots
4. **Scalable**: Works with any number of bots
5. **No central coordination**: Each bot makes independent decisions (true stigmergy)

## Test Results

All collision avoidance tests pass:

✅ **Bot maintains safe distance from other bots**
- Validates that separation force keeps bots apart

✅ **Bot detects path blocked by another bot**
- Ensures bots can identify obstacles in their path

✅ **Multiple bots avoid each other while assembling**
- Verifies no collisions occur during full assembly with 3+ bots

✅ **Bot navigates around stationary bot**
- Confirms bots can route around locked obstacles and still reach targets

## Usage

The collision avoidance is automatically active when the swarm system updates:

```typescript
// In AutonomousSwarmSystem.update()
for (const bot of this.bots) {
  bot.move(dt, slotOrientation, this.bots); // Pass all bots for avoidance
}
```

## Practical Application

This implementation enables physical microrobot swarms to:

1. **Assemble structures autonomously**: Multiple robots can work simultaneously
2. **Navigate crowded spaces**: Robots avoid each other in tight areas
3. **Handle dynamic obstacles**: Works with both moving and stationary robots
4. **Scale efficiently**: No central planning required, each robot acts independently

## Visual Behavior

When you run the application (`npm run dev`), you'll observe:

- Bots approach their target slots
- When bots get close, they subtly adjust their paths
- Bots navigate around locked (assembled) bots
- No collisions occur during assembly
- Smooth, natural-looking avoidance behavior

## Algorithm Inspiration

The implementation draws from:
- **Boids algorithm**: Separation force for flocking behavior
- **Potential field methods**: Repulsive forces from obstacles
- **Velocity obstacles**: Path prediction and collision detection
- **Stigmergy**: Decentralized decision-making

## Performance

### Optimization Strategy

The collision avoidance system includes smart filtering to prevent lag:

1. **State-based filtering**: Only bots in the `approaching` state perform collision checks
   - Idle bots in the hub don't check collisions (prevents O(n²) lag when many bots are clustered)
   - Searching/wandering bots use simple movement without collision checks

2. **Relevant bot filtering**: Approaching bots only check collisions with:
   - Other `approaching` bots (active movers)
   - `locked` bots (stationary obstacles in the structure)
   - Skips `idle` and `searching` bots to reduce checks

### Complexity

- **Worst case**: O(m²) where m is the number of approaching bots
- **Typical case**: Much better than O(n²) since only a subset of bots are approaching at any time
- **Hub clustering**: No performance impact - idle bots don't run collision checks
- **Current scale**: Efficient for typical swarms of 10-50 bots, scales well to 100+ bots

### Why This Matters

Without this optimization, when 50 bots are clustered in the hub:
- ❌ Would perform 50² = 2,500 collision checks per frame
- ❌ Causes significant lag and stuttering

With optimization, only approaching bots (e.g., 5 active):
- ✅ Performs only ~25 collision checks per frame
- ✅ Smooth, responsive performance
- ✅ Scales naturally with assembly progress

