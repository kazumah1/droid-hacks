// Component visualization utilities
import * as THREE from 'three';
import type { AssemblyPlan, Component } from './ai-assembly';

/**
 * Generate distinct colors for each component
 */
export function generateComponentColors(numComponents: number): THREE.Color[] {
  const colors: THREE.Color[] = [];
  for (let i = 0; i < numComponents; i++) {
    const hue = (i / numComponents) * 360;
    const color = new THREE.Color().setHSL(hue / 360, 0.7, 0.6);
    colors.push(color);
  }
  return colors;
}

/**
 * Component metadata for visualization
 */
export interface ComponentVisualization {
  component: Component;
  color: THREE.Color;
  meshes: THREE.Mesh[];
  visible: boolean;
  buildProgress: number; // 0 to 1
}

/**
 * Create visual representation of components with different colors
 */
export function createComponentVisualizations(
  plan: AssemblyPlan,
  scene: THREE.Scene,
  cellSize: number = 0.6
): ComponentVisualization[] {
  const colors = generateComponentColors(plan.components.length);
  const visualizations: ComponentVisualization[] = [];
  const GRID_CENTER = 24.5; // center of 0-49 grid

  plan.components.forEach((component, index) => {
    const color = colors[index];
    const meshes: THREE.Mesh[] = [];

    component.voxels.forEach(voxel => {
      // Match exact cube size for perfect alignment with assembled cubes
      const geometry = new THREE.BoxGeometry(cellSize, cellSize, cellSize);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.2,
        roughness: 0.7,
        emissive: color,
        emissiveIntensity: 0.1,
        transparent: true,
        opacity: 0.2, // Very transparent to show as blueprint guide only
      });

      const mesh = new THREE.Mesh(geometry, material);
      const worldX = (voxel.x - GRID_CENTER) * cellSize;
      const worldY = 0.3 + voxel.y * cellSize;
      const worldZ = (voxel.z - GRID_CENTER) * cellSize;
      mesh.position.set(worldX, worldY, worldZ);
      
      // Add edge wireframe for blueprint visibility
      const edges = new THREE.EdgesGeometry(geometry);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.4 })
      );
      mesh.add(line);

      mesh.visible = false; // Start hidden
      scene.add(mesh);
      meshes.push(mesh);
    });

    visualizations.push({
      component,
      color,
      meshes,
      visible: false,
      buildProgress: 0,
    });
  });

  return visualizations;
}

/**
 * Toggle component visibility
 */
export function toggleComponentVisibility(
  visualization: ComponentVisualization,
  visible: boolean
): void {
  visualization.visible = visible;
  visualization.meshes.forEach(mesh => {
    mesh.visible = visible;
  });
}

/**
 * Animate component building progress
 */
export function updateComponentBuildProgress(
  visualization: ComponentVisualization,
  progress: number
): void {
  visualization.buildProgress = Math.max(0, Math.min(1, progress));
  
  const numToShow = Math.floor(visualization.meshes.length * visualization.buildProgress);
  visualization.meshes.forEach((mesh, index) => {
    mesh.visible = visualization.visible && index < numToShow;
  });
}

/**
 * Get component statistics
 */
export function getComponentStats(plan: AssemblyPlan): {
  totalComponents: number;
  totalVoxels: number;
  avgVoxelsPerComponent: number;
  maxDependencyDepth: number;
  componentsByOrder: Map<number, Component[]>;
} {
  const componentsByOrder = new Map<number, Component[]>();
  
  plan.components.forEach(component => {
    const order = component.assemblyOrder;
    if (!componentsByOrder.has(order)) {
      componentsByOrder.set(order, []);
    }
    componentsByOrder.get(order)!.push(component);
  });

  // Calculate max dependency depth
  const depths = new Map<string, number>();
  const calculateDepth = (componentId: string): number => {
    if (depths.has(componentId)) {
      return depths.get(componentId)!;
    }
    
    const component = plan.components.find(c => c.id === componentId);
    if (!component || component.dependencies.length === 0) {
      depths.set(componentId, 0);
      return 0;
    }
    
    const maxDepthOfDeps = Math.max(
      ...component.dependencies.map(depId => calculateDepth(depId))
    );
    const depth = maxDepthOfDeps + 1;
    depths.set(componentId, depth);
    return depth;
  };

  plan.components.forEach(component => calculateDepth(component.id));
  const maxDependencyDepth = Math.max(...Array.from(depths.values()), 0);

  return {
    totalComponents: plan.components.length,
    totalVoxels: plan.totalVoxels,
    avgVoxelsPerComponent: plan.totalVoxels / plan.components.length,
    maxDependencyDepth,
    componentsByOrder,
  };
}

/**
 * Export component visualization as text art (for debugging/console)
 */
export function componentToAsciiArt(component: Component): string {
  const minX = Math.min(...component.voxels.map(v => v.x));
  const maxX = Math.max(...component.voxels.map(v => v.x));
  const minY = Math.min(...component.voxels.map(v => v.y));
  const maxY = Math.max(...component.voxels.map(v => v.y));
  const minZ = Math.min(...component.voxels.map(v => v.z));
  const maxZ = Math.max(...component.voxels.map(v => v.z));

  let art = `${component.name} (${component.voxels.length} voxels)\n`;
  art += `Bounds: X[${minX}-${maxX}] Y[${minY}-${maxY}] Z[${minZ}-${maxZ}]\n`;
  
  // Create a 3D grid
  const grid = new Set<string>();
  component.voxels.forEach(v => {
    grid.add(`${v.x},${v.y},${v.z}`);
  });

  // Show layers from bottom to top
  for (let y = minY; y <= maxY; y++) {
    art += `\nLayer Y=${y}:\n`;
    for (let z = minZ; z <= maxZ; z++) {
      let row = '';
      for (let x = minX; x <= maxX; x++) {
        row += grid.has(`${x},${y},${z}`) ? '█' : '·';
      }
      art += row + '\n';
    }
  }

  return art;
}

/**
 * Validate assembly plan structure
 */
export function validateAssemblyPlan(plan: AssemblyPlan): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check components exist
  if (!plan.components || plan.components.length === 0) {
    errors.push('No components defined');
  }

  // Check for duplicate component IDs
  const ids = new Set<string>();
  plan.components.forEach(component => {
    if (ids.has(component.id)) {
      errors.push(`Duplicate component ID: ${component.id}`);
    }
    ids.add(component.id);
  });

  // Check dependencies reference valid components
  plan.components.forEach(component => {
    component.dependencies.forEach(depId => {
      if (!ids.has(depId)) {
        errors.push(`Component "${component.id}" has invalid dependency: "${depId}"`);
      }
    });
  });

  // Check for circular dependencies (simple check)
  const hasPath = (from: string, to: string, visited = new Set<string>()): boolean => {
    if (from === to) return true;
    if (visited.has(from)) return false;
    visited.add(from);

    const component = plan.components.find(c => c.id === from);
    if (!component) return false;

    return component.dependencies.some(depId => hasPath(depId, to, visited));
  };

  plan.components.forEach(component => {
    component.dependencies.forEach(depId => {
      if (hasPath(depId, component.id)) {
        errors.push(`Circular dependency detected: ${component.id} <-> ${depId}`);
      }
    });
  });

  // Check voxel coordinates are within bounds (0-49 grid)
  plan.components.forEach(component => {
    component.voxels.forEach((voxel, index) => {
      if (voxel.x < 0 || voxel.x > 49 || voxel.y < 0 || voxel.y > 49 || voxel.z < 0 || voxel.z > 49) {
        warnings.push(
          `Component "${component.id}" voxel ${index} out of bounds: (${voxel.x}, ${voxel.y}, ${voxel.z})`
        );
      }
    });
  });

  // Check total voxel count matches
  const actualTotal = plan.components.reduce((sum, c) => sum + c.voxels.length, 0);
  if (actualTotal !== plan.totalVoxels) {
    warnings.push(
      `Total voxel count mismatch: declared ${plan.totalVoxels}, actual ${actualTotal}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

