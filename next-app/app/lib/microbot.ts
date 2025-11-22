// lib/microbot.ts
import * as THREE from 'three';

export function createMicrobotMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body – metallic rod
  const bodyGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12);
  const bodyMat = new THREE.MeshStandardMaterial({
    metalness: 0.9,
    roughness: 0.3,
    color: 0x888888,
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.rotation.z = Math.PI / 2; // lie on its side
  group.add(body);

  // Magnet ends – emissive spheres
  const endGeom = new THREE.SphereGeometry(0.16, 16, 16);
  const endMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: 0x4f7dff,
    emissiveIntensity: 1.8,
    metalness: 0.8,
    roughness: 0.2,
  });

  const left = new THREE.Mesh(endGeom, endMat);
  const right = new THREE.Mesh(endGeom, endMat);
  left.position.set(-0.3, 0, 0);
  right.position.set(0.3, 0, 0);
  group.add(left, right);

  return group;
}
