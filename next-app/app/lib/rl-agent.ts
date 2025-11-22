// RL Agent Integration - Load trained model and run inference
// Uses ONNX Runtime Web for browser-based inference

import * as THREE from 'three';

export interface RLObservation {
  position: [number, number];
  gridState: number[];
  hasBlock: boolean;
  targetStructure: number[];
}

export class RLAgent {
  id: number;
  mesh: THREE.Group;
  position: THREE.Vector3;
  gridPosition: [number, number, number];  // 3D now!
  hasBlock: boolean = true;
  
  // RL-specific
  session: any = null; // ONNX inference session
  gridSize: number = 8;
  
  constructor(id: number, mesh: THREE.Group, gridSize: number = 8) {
    this.id = id;
    this.mesh = mesh;
    this.position = mesh.position.clone();
    this.gridSize = gridSize;
    this.gridPosition = [
      Math.floor((this.position.x + 4) / 0.6),
      Math.floor(this.position.y / 0.6),  // Y coordinate now!
      Math.floor((this.position.z + 4) / 0.6),
    ];
  }
  
  /**
   * Get observation vector (1028 features for 3D!)
   */
  getObservation(grid: number[][][], target: number[][][]): Float32Array {
    const obs = new Float32Array(1028);
    let idx = 0;
    
    // Position (3 features, normalized)
    obs[idx++] = this.gridPosition[0] / this.gridSize;
    obs[idx++] = this.gridPosition[1] / this.gridSize;
    obs[idx++] = this.gridPosition[2] / this.gridSize;
    
    // Grid state (512 features, flattened 8×8×8)
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        for (let k = 0; k < this.gridSize; k++) {
          obs[idx++] = grid[i][j][k];
        }
      }
    }
    
    // Has block (1 feature)
    obs[idx++] = this.hasBlock ? 1.0 : 0.0;
    
    // Target structure (512 features, flattened 8×8×8)
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        for (let k = 0; k < this.gridSize; k++) {
          obs[idx++] = target[i][j][k];
        }
      }
    }
    
    return obs;
  }
  
  /**
   * Predict action using loaded model
   */
  async predictAction(observation: Float32Array): Promise<number> {
    if (!this.session) {
      // Fallback to random if model not loaded
      return Math.floor(Math.random() * 6);
    }
    
    try {
      // ONNX Runtime inference (3D)
      const inputTensor = new (window as any).ort.Tensor(
        'float32',
        observation,
        [1, 1028]
      );
      
      const results = await this.session.run({ observation: inputTensor });
      const probs = results.action_probs.data;
      
      // Sample from probability distribution
      return this.sampleAction(Array.from(probs));
    } catch (error) {
      console.error('RL inference error:', error);
      return Math.floor(Math.random() * 6);
    }
  }
  
  /**
   * Sample action from probability distribution
   */
  sampleAction(probs: number[]): number {
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (r < cumulative) return i;
    }
    return probs.length - 1;
  }
  
  /**
   * Execute action in 3D world
   * Actions: 0=forward, 1=right, 2=backward, 3=left, 4=up, 5=down, 6=place, 7=pickup
   */
  executeAction(action: number, grid: number[][][], cellSize: number = 0.6) {
    const [x, y, z] = this.gridPosition;
    
    switch (action) {
      case 0: // Forward (-X)
        if (x > 0) {
          this.gridPosition[0]--;
          this.position.x -= cellSize;
        }
        break;
      case 1: // Right (+Z)
        if (z < this.gridSize - 1) {
          this.gridPosition[2]++;
          this.position.z += cellSize;
        }
        break;
      case 2: // Backward (+X)
        if (x < this.gridSize - 1) {
          this.gridPosition[0]++;
          this.position.x += cellSize;
        }
        break;
      case 3: // Left (-Z)
        if (z > 0) {
          this.gridPosition[2]--;
          this.position.z -= cellSize;
        }
        break;
      case 4: // Up (+Y)
        if (y < this.gridSize - 1) {
          // Can move up if there's a block below or at ground
          if (y === 0 || grid[x][y-1][z] > 0) {
            this.gridPosition[1]++;
            this.position.y += cellSize;
          }
        }
        break;
      case 5: // Down (-Y)
        if (y > 0) {
          this.gridPosition[1]--;
          this.position.y -= cellSize;
        }
        break;
      case 6: // Place block
        if (this.hasBlock) {
          grid[x][y][z] = 1.0;
          this.hasBlock = false;
          this.setColor(0x888888); // Gray when no block
        }
        break;
      case 7: // Pickup block
        if (!this.hasBlock && grid[x][y][z] === 0) {
          this.hasBlock = true;
          this.setColor(0x4f7dff); // Blue when carrying
        }
        break;
    }
    
    // Sync mesh position
    this.mesh.position.copy(this.position);
  }
  
  setColor(hex: number) {
    this.mesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (child.material.emissive) {
          child.material.emissive.setHex(hex);
        }
      }
    });
  }
}

export class RLSwarmController {
  agents: RLAgent[];
  grid: number[][][];
  target: number[][][];
  gridSize: number = 8;
  session: any = null;
  
  constructor(agents: RLAgent[], gridSize: number = 8) {
    this.agents = agents;
    this.gridSize = gridSize;
    this.grid = Array(gridSize).fill(0).map(() => 
      Array(gridSize).fill(0).map(() => 
        Array(gridSize).fill(0)
      )
    );
    this.target = this.makePyramidTarget();
  }
  
  makePyramidTarget(): number[][][] {
    const target = Array(this.gridSize).fill(0).map(() => 
      Array(this.gridSize).fill(0).map(() => 
        Array(this.gridSize).fill(0)
      )
    );
    
    // 3D pyramid
    const maxHeight = 4;
    for (let y = 0; y < maxHeight; y++) {
      const size = maxHeight - y;
      const offset = (this.gridSize - size) / 2;
      for (let x = offset; x < offset + size; x++) {
        for (let z = offset; z < offset + size; z++) {
          target[Math.floor(x)][y][Math.floor(z)] = 1.0;
        }
      }
    }
    
    return target;
  }
  
  /**
   * Load trained model from ONNX file
   */
  async loadModel(modelPath: string) {
    try {
      const ort = (window as any).ort;
      if (!ort) {
        console.error('ONNX Runtime not loaded. Add <script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js">');
        return;
      }
      
      this.session = await ort.InferenceSession.create(modelPath);
      
      // Share session with all agents
      this.agents.forEach(agent => agent.session = this.session);
      
      console.log('✅ RL Model loaded successfully');
    } catch (error) {
      console.error('Failed to load RL model:', error);
    }
  }
  
  /**
   * Update all agents (RL decision making)
   */
  async update(dt: number) {
    for (const agent of this.agents) {
      // Get observation
      const obs = agent.getObservation(this.grid, this.target);
      
      // Predict action
      const action = await agent.predictAction(obs);
      
      // Execute action
      agent.executeAction(action, this.grid);
    }
  }
  
  /**
   * Calculate match score for visualization (3D)
   */
  getMatchScore(): number {
    let correct = 0;
    let total = 0;
    
    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        for (let k = 0; k < this.gridSize; k++) {
          if (this.target[i][j][k] > 0) {
            total++;
            if (this.grid[i][j][k] > 0) {
              correct++;
            }
          }
        }
      }
    }
    
    return total > 0 ? correct / total : 0;
  }
  
  reset() {
    this.grid = Array(this.gridSize).fill(0).map(() => 
      Array(this.gridSize).fill(0).map(() => 
        Array(this.gridSize).fill(0)
      )
    );
    this.agents.forEach(agent => {
      agent.hasBlock = true;
      agent.setColor(0x4f7dff);
    });
  }
}

