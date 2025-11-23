// Text-Conditioned RL Agent - Loads trained model and runs text-driven assembly
// Uses ONNX Runtime Web for browser-based inference

import * as THREE from 'three';

export interface RLObservation {
  position: [number, number, number];
  localGrid: number[]; // 3×3×3 = 27
  localScent: number[]; // 3×3×3 = 27
  hasBlock: boolean;
  textEmbedding: number[]; // 384 from sentence-transformers
}

export class TextConditionedRLAgent {
  id: number;
  mesh: THREE.Group;
  position: THREE.Vector3;
  gridPosition: [number, number, number];
  hasBlock: boolean = true;
  
  // RL-specific
  session: any = null; // ONNX inference session
  gridSize: number = 8;
  localObsSize: number = 3; // 3×3×3 local patch
  
  constructor(id: number, mesh: THREE.Group, gridSize: number = 8) {
    this.id = id;
    this.mesh = mesh;
    this.position = mesh.position.clone();
    this.gridSize = gridSize;
    // RL agents start at hub (0, 0.3, 0), map to grid coordinates
    // Grid is centered at origin, so we offset by gridSize/2
    const offset = gridSize / 2;
    this.gridPosition = [
      Math.floor((this.position.x / 0.6) + offset),
      Math.floor(this.position.y / 0.6),
      Math.floor((this.position.z / 0.6) + offset),
    ];
    // Clamp to valid grid range
    this.gridPosition[0] = Math.max(0, Math.min(gridSize - 1, this.gridPosition[0]));
    this.gridPosition[1] = Math.max(0, Math.min(gridSize - 1, this.gridPosition[1]));
    this.gridPosition[2] = Math.max(0, Math.min(gridSize - 1, this.gridPosition[2]));
  }
  
  /**
   * Get LOCAL observation (3×3×3 patch around agent)
   * Total: 3 (pos) + 27 (local grid) + 27 (local scent) + 1 (has block) = 58 features
   * Text embedding is passed separately to the model
   */
  getObservation(
    grid: number[][][], 
    scentField: number[][][]
  ): Float32Array {
    const obs = new Float32Array(58);
    let idx = 0;
    
    // 1. Normalized position (3)
    obs[idx++] = this.gridPosition[0] / this.gridSize;
    obs[idx++] = this.gridPosition[1] / this.gridSize;
    obs[idx++] = this.gridPosition[2] / this.gridSize;
    
    // 2. Local grid patch (27)
    const half = Math.floor(this.localObsSize / 2);
    for (let dx = -half; dx <= half; dx++) {
      for (let dy = -half; dy <= half; dy++) {
        for (let dz = -half; dz <= half; dz++) {
          const wx = this.gridPosition[0] + dx;
          const wy = this.gridPosition[1] + dy;
          const wz = this.gridPosition[2] + dz;
          
          if (wx >= 0 && wx < this.gridSize && 
              wy >= 0 && wy < this.gridSize && 
              wz >= 0 && wz < this.gridSize) {
            obs[idx++] = grid[wx][wy][wz];
          } else {
            obs[idx++] = 0; // Out of bounds = empty
          }
        }
      }
    }
    
    // 3. Local scent field patch (27)
    for (let dx = -half; dx <= half; dx++) {
      for (let dy = -half; dy <= half; dy++) {
        for (let dz = -half; dz <= half; dz++) {
          const wx = this.gridPosition[0] + dx;
          const wy = this.gridPosition[1] + dy;
          const wz = this.gridPosition[2] + dz;
          
          if (wx >= 0 && wx < this.gridSize && 
              wy >= 0 && wy < this.gridSize && 
              wz >= 0 && wz < this.gridSize) {
            obs[idx++] = scentField[wx][wy][wz];
          } else {
            obs[idx++] = 0;
          }
        }
      }
    }
    
    // 4. Has block (1)
    obs[idx++] = this.hasBlock ? 1.0 : 0.0;
    
    return obs;
  }
  
  /**
   * Predict action using loaded model
   * Model expects separate observation and text_embedding inputs
   */
  async predictAction(observation: Float32Array, textEmbedding: Float32Array): Promise<number> {
    if (!this.session) {
      // Fallback to random if model not loaded
      return Math.floor(Math.random() * 8);
    }
    
    try {
      const ort = (window as any).ort;
      
      // ONNX Runtime inference with separate inputs
      const obsTensor = new ort.Tensor('float32', observation, [1, 58]);
      const textTensor = new ort.Tensor('float32', textEmbedding, [1, 384]);
      
      const results = await this.session.run({
        observation: obsTensor,
        text_embedding: textTensor
      });
      
      const probs = results.action_probs.data;
      
      // Sample from probability distribution
      return this.sampleAction(Array.from(probs));
    } catch (error) {
      console.error('RL inference error:', error);
      return Math.floor(Math.random() * 8);
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
   * Actions: 0-5=movement, 6=place, 7=pickup
   */
  executeAction(action: number, grid: number[][][], cellSize: number = 0.6) {
    const [x, y, z] = this.gridPosition;
    const offset = this.gridSize / 2;
    
    switch (action) {
      case 0: // Forward (-X)
        if (x > 0) {
          this.gridPosition[0]--;
          this.position.x = (this.gridPosition[0] - offset) * cellSize;
        }
        break;
      case 1: // Right (+Z)
        if (z < this.gridSize - 1) {
          this.gridPosition[2]++;
          this.position.z = (this.gridPosition[2] - offset) * cellSize;
        }
        break;
      case 2: // Backward (+X)
        if (x < this.gridSize - 1) {
          this.gridPosition[0]++;
          this.position.x = (this.gridPosition[0] - offset) * cellSize;
        }
        break;
      case 3: // Left (-Z)
        if (z > 0) {
          this.gridPosition[2]--;
          this.position.z = (this.gridPosition[2] - offset) * cellSize;
        }
        break;
      case 4: // Up (+Y)
        if (y < this.gridSize - 1) {
          // Can move up if there's a block below or at ground
          if (y === 0 || grid[x][y-1][z] > 0) {
            this.gridPosition[1]++;
            this.position.y = this.gridPosition[1] * cellSize;
          }
        }
        break;
      case 5: // Down (-Y)
        if (y > 0) {
          this.gridPosition[1]--;
          this.position.y = this.gridPosition[1] * cellSize;
        }
        break;
      case 6: // Place block
        if (this.hasBlock && grid[x][y][z] === 0) {
          grid[x][y][z] = 1.0;
          this.hasBlock = false;
          this.setColor(0x888888); // Gray when no block
        }
        break;
      case 7: // Pickup block
        if (!this.hasBlock && grid[x][y][z] > 0) {
          grid[x][y][z] = 0.0;
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

export class TextConditionedRLController {
  agents: TextConditionedRLAgent[];
  grid: number[][][];
  target: number[][][];
  scentField: number[][][];
  gridSize: number = 8;
  session: any = null;
  textEmbedding: number[] = [];
  currentText: string = '';
  scene: THREE.Scene | null = null;
  blockMeshes: Map<string, THREE.Mesh> = new Map();
  cellSize: number = 0.6;
  private isUpdating = false;
  private nextAgentIndex = 0;
  
  constructor(agents: TextConditionedRLAgent[], gridSize: number = 8, scene?: THREE.Scene) {
    this.agents = agents;
    this.gridSize = gridSize;
    this.grid = this.makeEmpty3DGrid();
    this.target = this.makeEmpty3DGrid();
    this.scentField = this.makeEmpty3DGrid();
    this.scene = scene || null;
  }
  
  makeEmpty3DGrid(): number[][][] {
    return Array(this.gridSize).fill(0).map(() => 
      Array(this.gridSize).fill(0).map(() => 
        Array(this.gridSize).fill(0)
      )
    );
  }
  
  /**
   * Set target structure from voxels (comes from LLM)
   * Voxels are in 0-49 grid from LLM, need to scale to 8×8×8 RL grid
   */
  setTargetFromVoxels(voxels: { x: number, y: number, z: number }[], text: string) {
    this.currentText = text;
    this.target = this.makeEmpty3DGrid();
    
    if (voxels.length === 0) {
      console.warn('[RL] No voxels provided to setTargetFromVoxels');
      return;
    }
    
    // Find bounding box of voxels
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    voxels.forEach(v => {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z);
      maxZ = Math.max(maxZ, v.z);
    });
    
    // Scale to fit in 8×8×8 grid
    const scaleX = (this.gridSize - 1) / Math.max(1, maxX - minX);
    const scaleY = (this.gridSize - 1) / Math.max(1, maxY - minY);
    const scaleZ = (this.gridSize - 1) / Math.max(1, maxZ - minZ);
    const scale = Math.min(scaleX, scaleY, scaleZ);
    
    let targetCount = 0;
    // Map voxels to 8×8×8 grid
    voxels.forEach(v => {
      const gx = Math.floor((v.x - minX) * scale);
      const gy = Math.floor((v.y - minY) * scale);
      const gz = Math.floor((v.z - minZ) * scale);
      
      if (gx >= 0 && gx < this.gridSize && 
          gy >= 0 && gy < this.gridSize && 
          gz >= 0 && gz < this.gridSize) {
        this.target[gx][gy][gz] = 1.0;
        targetCount++;
      }
    });
    
    console.log(`[RL] Set target: ${targetCount} voxels in 8×8×8 grid from ${voxels.length} LLM voxels`);
    
    // Generate scent field
    this.generateScentField();
    
    // Generate text embedding (simple hash for now - replace with real embeddings later)
    this.textEmbedding = this.simpleTextEmbedding(text);
    console.log(`[RL] Text embedding generated (${this.textEmbedding.length} dims) for: "${text}"`);
  }
  
  /**
   * Generate scent field (potential gradient toward target blocks)
   */
  generateScentField() {
    // Simple gradient: distance to nearest target block
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        for (let z = 0; z < this.gridSize; z++) {
          let minDist = Infinity;
          
          // Find nearest target block
          for (let tx = 0; tx < this.gridSize; tx++) {
            for (let ty = 0; ty < this.gridSize; ty++) {
              for (let tz = 0; tz < this.gridSize; tz++) {
                if (this.target[tx][ty][tz] > 0) {
                  const dist = Math.sqrt(
                    Math.pow(x - tx, 2) + 
                    Math.pow(y - ty, 2) + 
                    Math.pow(z - tz, 2)
                  );
                  minDist = Math.min(minDist, dist);
                }
              }
            }
          }
          
          // Convert distance to scent (high = close to target)
          const maxDist = Math.sqrt(3 * this.gridSize * this.gridSize);
          this.scentField[x][y][z] = 1.0 - (minDist / maxDist);
        }
      }
    }
  }
  
  /**
   * Simple text embedding (deterministic hash)
   * TODO: Replace with real embeddings from sentence-transformers
   */
  simpleTextEmbedding(text: string): number[] {
    const embedding = new Array(384).fill(0);
    
    // Simple character-based hashing
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const idx = (charCode * (i + 1)) % 384;
      embedding[idx] += 0.1;
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }
  
  /**
   * Load trained model from ONNX file
   */
  async loadModel(modelPath: string = '/policy_text_conditioned.onnx') {
    try {
      const ort = (window as any).ort;
      if (!ort) {
        console.error('ONNX Runtime not loaded!');
        return false;
      }
      
      this.session = await ort.InferenceSession.create(modelPath);
      
      // Share session with all agents
      this.agents.forEach(agent => agent.session = this.session);
      
      console.log('✅ Text-Conditioned RL Model loaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to load RL model:', error);
      return false;
    }
  }
  
  /**
   * Update all agents (RL decision making)
   */
  async update(dt: number) {
    if (this.isUpdating) return; // Prevent re-entrant calls
    this.isUpdating = true;

    try {
      if (this.textEmbedding.length === 0) {
        return; // No target set yet
      }
      
      if (!this.session) {
        return; // Model not loaded yet
      }
      
      // Process agents SEQUENTIALLY with a time budget
      // ONNX Runtime Web sessions are not thread-safe for parallel execution
      // and too many sequential runs will drop frames
      const startTime = performance.now();
      const timeBudget = 12; // ms (target 60fps = 16ms total, leave room for rendering)
      let blocksPlaced = 0;
      let processedCount = 0;
      
      // Cycle through agents starting from where we left off
      // This ensures fairness even if we can't process everyone in one frame
      const totalAgents = this.agents.length;
      
      for (let i = 0; i < totalAgents; i++) {
        // Check time budget
        if (performance.now() - startTime > timeBudget) {
          break;
        }

        const agentIndex = (this.nextAgentIndex + i) % totalAgents;
        const agent = this.agents[agentIndex];
        processedCount++;
        
        // Get observation (without text embedding)
        const obs = agent.getObservation(this.grid, this.scentField);
        
        // Convert text embedding to Float32Array
        const textEmb = new Float32Array(this.textEmbedding);
        
        // Predict action with separate inputs
        const action = await agent.predictAction(obs, textEmb);
        
        // Track if block was placed
        const hadBlock = agent.hasBlock;
        
        // Execute action
        agent.executeAction(action, this.grid);
        
        // Check if block was placed
        if (hadBlock && !agent.hasBlock) {
          blocksPlaced++;
        }
      }
      
      // Update pointer for next frame
      this.nextAgentIndex = (this.nextAgentIndex + processedCount) % totalAgents;
      
      // Update visualization
      this.updateVisualization();
      
      // Debug logging (every 60 frames ~1 second)
      if (Math.random() < 0.016) {
        const matchScore = this.getMatchScore();
        const totalBlocks = this.grid.flat(2).filter(v => v > 0).length;
        console.log(`[RL] Match: ${(matchScore * 100).toFixed(1)}%, Blocks placed: ${totalBlocks}, Agents: ${this.agents.length}`);
      }
    } finally {
      this.isUpdating = false;
    }
  }
  
  /**
   * Update Three.js visualization of placed blocks
   */
  updateVisualization() {
    if (!this.scene) return;
    
    const offset = this.gridSize / 2;
    
    // Remove old meshes that are no longer in grid
    for (const [key, mesh] of this.blockMeshes.entries()) {
      const [x, y, z] = key.split(',').map(Number);
      if (this.grid[x][y][z] === 0) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
        this.blockMeshes.delete(key);
      }
    }
    
    // Add new meshes for placed blocks
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        for (let z = 0; z < this.gridSize; z++) {
          if (this.grid[x][y][z] > 0) {
            const key = `${x},${y},${z}`;
            if (!this.blockMeshes.has(key)) {
              // Create block mesh
              const geometry = new THREE.BoxGeometry(this.cellSize, this.cellSize, this.cellSize);
              const material = new THREE.MeshStandardMaterial({
                color: 0x4f7dff,
                metalness: 0.5,
                roughness: 0.4,
                emissive: 0x4f7dff,
                emissiveIntensity: 0.3,
              });
              const mesh = new THREE.Mesh(geometry, material);
              
              // Position in world space
              mesh.position.set(
                (x - offset) * this.cellSize,
                y * this.cellSize + 0.3,
                (z - offset) * this.cellSize
              );
              
              this.scene.add(mesh);
              this.blockMeshes.set(key, mesh);
            }
          }
        }
      }
    }
  }
  
  /**
   * Control visibility of all RL blocks
   */
  setVisible(visible: boolean) {
    for (const mesh of this.blockMeshes.values()) {
      mesh.visible = visible;
    }
  }

  /**
   * Calculate match score for visualization
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
    this.grid = this.makeEmpty3DGrid();
    
    // Clear all block meshes
    if (this.scene) {
      for (const mesh of this.blockMeshes.values()) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
      this.blockMeshes.clear();
    }
    
    const offset = this.gridSize / 2;
    this.agents.forEach(agent => {
      agent.hasBlock = true;
      agent.setColor(0x4f7dff);
      // Reset to random ground positions
      agent.gridPosition = [
        Math.floor(Math.random() * this.gridSize),
        0,
        Math.floor(Math.random() * this.gridSize)
      ];
      // Update mesh position
      agent.position.set(
        (agent.gridPosition[0] - offset) * 0.6,
        agent.gridPosition[1] * 0.6,
        (agent.gridPosition[2] - offset) * 0.6
      );
      agent.mesh.position.copy(agent.position);
    });
  }
}
