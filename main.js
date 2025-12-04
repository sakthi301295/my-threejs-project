import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

let sandPositions, velocities;
let scene, camera, renderer, controls;
let sandParticles;
let hourglass;
let isRotating = false;
let rotationProgress = 0;
const sandCount = 10000;
const clock = new THREE.Clock();

function glassRadiusAtY(y) {
  const normalizedY = (y + 1.25) / 2.5;
  return Math.cos(normalizedY * Math.PI) * 0.6 + 0.1;
}

function bottomSandHeight(x, z) {
  const maxPileHeight = 0.05;
  const dist = Math.sqrt(x * x + z * z);
  const radiusLimit = 0.6;
  if (dist > radiusLimit) return -Infinity;
  return -1.25 + (1 - dist / radiusLimit) * maxPileHeight;
}

init();
animate();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  updateSand(delta);

  if (isRotating) {
    const rotationSpeed = Math.PI * delta;
    hourglass.rotation.z += rotationSpeed;
    rotationProgress += rotationSpeed;

    if (rotationProgress >= Math.PI) {
      isRotating = false;
      rotationProgress = 0;
      resetSand();
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeeeeee);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  scene.add(light);

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x9c4a1a });

  const points = [];
  for (let i = 0; i <= 50; i++) {
    const y = -1.25 + (i / 50) * 2.5;
    const radius = Math.sin((i / 50) * Math.PI) * 0.6 + 0.1;
    points.push(new THREE.Vector2(radius, y));
  }
  const latheGeometry = new THREE.LatheGeometry(points, 64);
  const liquidMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0055ff,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.6,
    transmission: 1.0,
    thickness: 0.5,
  });

  hourglass = new THREE.Group();

  const topchambers = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 32), liquidMaterial);
  topchambers.position.y = 0.75;
  topchambers.rotation.x = Math.PI;
  hourglass.add(topchambers);

  const bottomchambers = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 32), liquidMaterial);
  bottomchambers.position.y = -0.75;
  hourglass.add(bottomchambers);

  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 32), woodMaterial);
  topCap.position.y = 1.6;
  hourglass.add(topCap);

  const bottomCap = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 32), woodMaterial);
  bottomCap.position.y = -1.6;
  hourglass.add(bottomCap);

  const handleHeight = 3.0;
  const handleRadius = 0.08;
  const offsetX = 0.75;
  const offsetZ = 0.75;

  const handleGeom = new THREE.CylinderGeometry(handleRadius, handleRadius, handleHeight, 16);
  const positions = [
    [offsetX, 0, offsetZ],
    [-offsetX, 0, offsetZ],
    [offsetX, 0, -offsetZ],
    [-offsetX, 0, -offsetZ],
  ];

  positions.forEach(([x, y, z]) => {
    const handle = new THREE.Mesh(handleGeom, woodMaterial);
    handle.position.set(x, y, z);
    hourglass.add(handle);
  });

  sandPositions = new Float32Array(sandCount * 3);
  velocities = Array.from({ length: sandCount }, () => new THREE.Vector3());
  const sandGeometry = new THREE.BufferGeometry();
  sandGeometry.setAttribute("position", new THREE.BufferAttribute(sandPositions, 3));
  const sandMaterial = new THREE.PointsMaterial({ color: 0xd9c088, size: 0.05 });
  sandParticles = new THREE.Points(sandGeometry, sandMaterial);

  hourglass.add(sandParticles);

  scene.add(hourglass);
  resetSand();

  window.addEventListener("click", () => {
    if (!isRotating) isRotating = true;
  });

  window.addEventListener("resize", onWindowResize);
}

function resetSand() {
  for (let i = 0; i < sandCount; i++) {
    const y = Math.random() * 1.5 + 0.3;
    const maxR = glassRadiusAtY(y) * 0.95;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * maxR;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    sandPositions.set([x, y, z], i * 3);
    velocities[i].set(0, 0, 0);
  }
  sandParticles.geometry.attributes.position.needsUpdate = true;
}

function updateSand(delta) {
  for (let i = 0; i < sandCount; i++) {
    const index = i * 3;
    let x = sandPositions[index];
    let y = sandPositions[index + 1];
    let z = sandPositions[index + 2];
    const velocity = velocities[i];

    velocity.y -= 0.5 * delta;
    x += velocity.x * delta;
    y += velocity.y * delta;
    z += velocity.z * delta;

    const radiusAtY = glassRadiusAtY(y);
    const radialDistance = Math.sqrt(x * x + z * z);

    if (radialDistance > radiusAtY) {
      const factor = radiusAtY / radialDistance;
      x *= factor;
      z *= factor;
      velocity.x *= -0.2;
      velocity.z *= -0.2;
    }

    const groundY = bottomSandHeight(x, z);
    if (y <= groundY + 0.01) {
      y = groundY + Math.random() * 0.02;
      velocity.set(0, 0, 0);
    }

    sandPositions[index] = x;
    sandPositions[index + 1] = y;
    sandPositions[index + 2] = z;
  }
  sandParticles.geometry.attributes.position.needsUpdate = true;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
