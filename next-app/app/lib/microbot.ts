// lib/microbot.ts
import * as THREE from 'three';

const BODY_RADIUS = 0.01;
const BODY_LENGTH = 0.42;
const END_RADIUS = 0.02;
const END_OFFSET = BODY_LENGTH / 2 - 0.01;

export function createMicrobotMesh(): THREE.Group {
  const group = new THREE.Group();

  // Body – metallic rod
  const bodyGeom = new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, BODY_LENGTH, 16);
  const bodyMat = new THREE.MeshStandardMaterial({
    metalness: 0.9,
    roughness: 0.3,
    color: 0xb0b0b0,
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.rotation.z = Math.PI / 2; // lie on its side
  group.add(body);

  // Magnet ends – emissive spheres
  const endGeom = new THREE.SphereGeometry(END_RADIUS, 16, 16);
  const endMat = new THREE.MeshStandardMaterial({
    color: 0x0b0b12,
    emissive: 0x5aa8ff,
    emissiveIntensity: 1.8,
    metalness: 0.8,
    roughness: 0.2,
  });

  const left = new THREE.Mesh(endGeom, endMat);
  const right = new THREE.Mesh(endGeom, endMat);
  left.position.set(-END_OFFSET, 0, 0);
  right.position.set(END_OFFSET, 0, 0);
  group.add(left, right);

  return group;
}
