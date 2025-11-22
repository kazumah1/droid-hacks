// lib/microbot.ts
import * as THREE from 'three';

const CUBE_SIZE = 0.6; // Full voxel size - perfectly fills grid cell for adjacent placement

export function createMicrobotMesh(): THREE.Group {
  const group = new THREE.Group();

  // Main cube body – full-sized voxel cube
  const cubeGeom = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  const cubeMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6, // blue
    emissive: 0x3b82f6,
    emissiveIntensity: 0.6,
    metalness: 0.5,
    roughness: 0.4,
  });
  const cube = new THREE.Mesh(cubeGeom, cubeMat);
  group.add(cube);

  // Add subtle edge wireframe - low opacity to avoid artifacts when adjacent
  const edges = new THREE.EdgesGeometry(cubeGeom);
  const edgeMat = new THREE.LineBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.15 
  });
  const edgeLines = new THREE.LineSegments(edges, edgeMat);
  group.add(edgeLines);

  return group;
}
