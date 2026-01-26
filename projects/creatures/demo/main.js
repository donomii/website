import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/webxr/VRButton.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// Camera setup - isometric view
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
camera.position.set(30, 30, 30);
camera.lookAt(0, 0, 0);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Add VR button
document.body.appendChild(VRButton.createButton(renderer));

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(20, 40, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;
scene.add(directionalLight);

// Ground plane
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a7c4a,
    roughness: 0.8
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grid helper for reference
const gridHelper = new THREE.GridHelper(100, 50, 0x888888, 0x888888);
gridHelper.material.opacity = 0.2;
gridHelper.material.transparent = true;
scene.add(gridHelper);

// Creature class
class Creature {
    constructor(x, z) {
        // Create block body
        const bodyGeometry = new THREE.BoxGeometry(1, 1.5, 1);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: this.getRandomColor()
        });
        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Create face
        this.createFace();

        // Position
        this.mesh.position.set(x, 1.5, z);

        // Movement properties
        this.targetPosition = new THREE.Vector3(x, 1.5, z);
        this.velocity = new THREE.Vector3();
        this.isMoving = false;
        this.moveSpeed = 0.02;

        // Floating animation
        this.floatOffset = Math.random() * Math.PI * 2;
        this.floatSpeed = 1 + Math.random() * 0.5;
        this.floatAmplitude = 0.1 + Math.random() * 0.1;

        // Task properties
        this.currentTask = null;
        this.taskState = 'idle'; // idle, moving_to_pickup, picking_up, carrying, dropping, eating
        this.carriedObject = null;
        this.eatingTimer = null;
        this.eatingTarget = null;

        // Collision properties
        this.collisionRadius = 0.7; // Slightly larger than the visual size for comfort

        // Schedule first movement
        this.scheduleNextMove();

        scene.add(this.mesh);
    }

    getRandomColor() {
        const colors = [
            0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24,
            0x6c5ce7, 0xa29bfe, 0xfd79a8, 0xfdcb6e
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    createFace() {
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.2, 0.3, 0.51);
        const leftPupil = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 8, 8),
            pupilMaterial
        );
        leftPupil.position.set(-0.2, 0.3, 0.56);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.2, 0.3, 0.51);
        const rightPupil = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 8, 8),
            pupilMaterial
        );
        rightPupil.position.set(0.2, 0.3, 0.56);

        // Mouth
        const mouthGeometry = new THREE.BoxGeometry(0.3, 0.05, 0.05);
        const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, -0.1, 0.51);

        this.mesh.add(leftEye);
        this.mesh.add(leftPupil);
        this.mesh.add(rightEye);
        this.mesh.add(rightPupil);
        this.mesh.add(mouth);
    }

    scheduleNextMove() {
        const delay = 2000 + Math.random() * 3000;
        setTimeout(() => {
            if (!this.currentTask) {
                this.pickNewTarget();
            }
        }, delay);
    }

    pickNewTarget() {
        if (this.currentTask) return; // Don't wander if we have a task

        const range = 40;
        const x = (Math.random() - 0.5) * range;
        const z = (Math.random() - 0.5) * range;
        this.targetPosition.set(x, 1.5, z);
        this.isMoving = true;
    }

    assignTask(task) {
        this.currentTask = task;
        this.taskState = 'moving_to_pickup';
        this.isMoving = true;
        // Target will be updated each frame in update() to follow the block
    }

    completeCurrentTask() {
        if (this.currentTask) {
            taskManager.completeTask(this.currentTask);
            this.currentTask = null;
            this.taskState = 'idle';
            this.carriedObject = null;
            this.cancelEating();
            this.scheduleNextMove();
        }
    }

    startEating(block) {
        this.taskState = 'eating';
        this.eatingTarget = block;

        // Back away from the block so it's in front of the creature
        // This looks better and gives other creatures a chance to steal it
        const dx = this.mesh.position.x - block.mesh.position.x;
        const dz = this.mesh.position.z - block.mesh.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > 0) {
            // Move back by 1.5 units in the direction away from the block
            const backupDistance = 1.5;
            this.mesh.position.x += (dx / distance) * backupDistance;
            this.mesh.position.z += (dz / distance) * backupDistance;

            // Face the block
            const angle = Math.atan2(-dx, -dz);
            this.mesh.rotation.y = angle;
        }

        // Eat for 5 seconds
        this.eatingTimer = setTimeout(() => {
            console.log('Nom nom nom! Creature finished eating the block!');

            // Make the block disappear (remove from scene)
            if (this.eatingTarget && this.eatingTarget.mesh.parent) {
                scene.remove(this.eatingTarget.mesh);
                this.eatingTarget.eaten = true;
            }

            // Finish eating and go back to idle
            this.taskState = 'idle';
            this.eatingTarget = null;
            this.scheduleNextMove();
        }, 5000);
    }

    cancelEating() {
        if (this.eatingTimer) {
            clearTimeout(this.eatingTimer);
            this.eatingTimer = null;
            this.eatingTarget = null;
        }
    }

    handleCollisions(others) {
        for (const other of others) {
            if (other === this) continue;

            const dx = this.mesh.position.x - other.mesh.position.x;
            const dz = this.mesh.position.z - other.mesh.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const minDistance = this.collisionRadius + other.collisionRadius;

            if (distance < minDistance && distance > 0) {
                // Creatures are colliding, push them apart
                const overlap = minDistance - distance;
                const pushX = (dx / distance) * overlap * 0.5;
                const pushZ = (dz / distance) * overlap * 0.5;

                this.mesh.position.x += pushX;
                this.mesh.position.z += pushZ;
            }
        }
    }

    checkFountainCollision(fountain) {
        const dx = this.mesh.position.x - fountain.position.x;
        const dz = this.mesh.position.z - fountain.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const minDistance = this.collisionRadius + fountain.collisionRadius;

        if (distance < minDistance && distance > 0) {
            // Push creature away from fountain
            const overlap = minDistance - distance;
            const pushX = (dx / distance) * overlap;
            const pushZ = (dz / distance) * overlap;

            this.mesh.position.x += pushX;
            this.mesh.position.z += pushZ;
        }
    }

    update(time) {
        // Floating animation
        const baseY = 1.5;
        const floatY = Math.sin(time * this.floatSpeed + this.floatOffset) * this.floatAmplitude;

        // If moving to pickup, continuously update target to follow the block
        // This creates fun chasing behavior when multiple creatures want the same block!
        if (this.taskState === 'moving_to_pickup' && this.currentTask) {
            const block = this.currentTask.data.block;
            this.targetPosition.set(block.mesh.position.x, 1.5, block.mesh.position.z);
        }

        // If eating, check if block was stolen
        if (this.taskState === 'eating' && this.eatingTarget) {
            if (this.eatingTarget.isBeingCarried) {
                // Block was stolen while eating! Cancel eating and go back to idle
                this.cancelEating();
                this.taskState = 'idle';
                this.scheduleNextMove();
                return;
            }
        }

        if (this.isMoving) {
            // Move towards target
            const direction = new THREE.Vector3()
                .subVectors(this.targetPosition, this.mesh.position)
                .normalize();

            const distance = this.mesh.position.distanceTo(this.targetPosition);

            if (distance < 0.1) {
                // Reached target
                this.isMoving = false;

                // Handle task state transitions
                if (this.taskState === 'moving_to_pickup') {
                    this.taskState = 'picking_up';
                    setTimeout(() => {
                        // Pick up the block
                        const block = this.currentTask.data.block;
                        block.pickUp(this);
                        this.carriedObject = block;
                        this.taskState = 'carrying';

                        // Pick a random drop location
                        const range = 40;
                        const dropX = (Math.random() - 0.5) * range;
                        const dropZ = (Math.random() - 0.5) * range;
                        this.currentTask.data.dropLocation = { x: dropX, z: dropZ };

                        // Move to drop location
                        this.targetPosition.set(dropX, 1.5, dropZ);
                        this.isMoving = true;
                    }, 500); // Brief pause to "pick up"
                } else if (this.taskState === 'carrying') {
                    this.taskState = 'dropping';
                    setTimeout(() => {
                        // Drop the block
                        const dropLoc = this.currentTask.data.dropLocation;
                        const droppedBlock = this.carriedObject;
                        this.carriedObject.drop(dropLoc.x, dropLoc.z);

                        // Complete the task first
                        taskManager.completeTask(this.currentTask);
                        this.currentTask = null;
                        this.carriedObject = null;

                        // Now start eating the block!
                        this.startEating(droppedBlock);
                    }, 500); // Brief pause to "drop"
                } else {
                    // Regular wandering
                    this.scheduleNextMove();
                }
            } else {
                // Move and rotate to face direction
                this.velocity.copy(direction).multiplyScalar(this.moveSpeed);
                this.mesh.position.x += this.velocity.x;
                this.mesh.position.z += this.velocity.z;

                // Rotate to face movement direction
                const angle = Math.atan2(direction.x, direction.z);
                this.mesh.rotation.y = angle;
            }
        }

        // Apply floating
        this.mesh.position.y = baseY + floatY;
    }
}

// Task System
class Task {
    constructor(type, data) {
        this.type = type;
        this.data = data;
        this.assignedTo = null;
        this.completed = false;
    }
}

class TaskManager {
    constructor() {
        this.tasks = [];
        this.availableCreatures = new Set();
    }

    addTask(task) {
        this.tasks.push(task);
    }

    registerCreature(creature) {
        this.availableCreatures.add(creature);
    }

    assignTask(creature, task) {
        task.assignedTo = creature;
        this.availableCreatures.delete(creature);
    }

    completeTask(task) {
        task.completed = true;
        if (task.assignedTo) {
            this.availableCreatures.add(task.assignedTo);
            task.assignedTo = null;
        }
        this.tasks = this.tasks.filter(t => t !== task);
    }

    tryAssignTasks() {
        const unassignedTasks = this.tasks.filter(t => !t.assignedTo);

        for (const task of unassignedTasks) {
            if (this.availableCreatures.size > 0) {
                // Pick a random available creature
                const available = Array.from(this.availableCreatures);
                const randomCreature = available[Math.floor(Math.random() * available.length)];

                this.assignTask(randomCreature, task);
                randomCreature.assignTask(task);
            }
        }
    }

    update() {
        this.tryAssignTasks();
    }
}

const taskManager = new TaskManager();

// Movable Block class
class MovableBlock {
    constructor(x, z, isFlying = false) {
        const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.7
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.set(x, 0.4, z);

        this.isBeingCarried = false;
        this.carrier = null;
        this.collisionRadius = 0.6;
        this.eaten = false;

        // Flying/trajectory properties
        this.isFlying = isFlying;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.gravity = -9.8;

        scene.add(this.mesh);
    }

    pickUp(creature) {
        this.isBeingCarried = true;
        this.carrier = creature;
    }

    drop(x, z) {
        this.isBeingCarried = false;
        this.carrier = null;
        this.mesh.position.set(x, 0.4, z);
    }

    update(deltaTime = 0.016) {
        if (this.isFlying) {
            // Apply gravity
            this.velocity.y += this.gravity * deltaTime;

            // Update position
            this.mesh.position.x += this.velocity.x * deltaTime;
            this.mesh.position.y += this.velocity.y * deltaTime;
            this.mesh.position.z += this.velocity.z * deltaTime;

            // Add some spin while flying for visual effect
            this.mesh.rotation.x += 0.1;
            this.mesh.rotation.z += 0.05;

            // Check if landed
            if (this.mesh.position.y <= 0.4) {
                this.mesh.position.y = 0.4;
                this.isFlying = false;
                this.velocity.set(0, 0, 0);
                // Reset rotation to upright
                this.mesh.rotation.set(0, 0, 0);
            }
        } else if (this.isBeingCarried && this.carrier) {
            // Follow carrier
            this.mesh.position.set(
                this.carrier.mesh.position.x,
                this.carrier.mesh.position.y + 1.2,
                this.carrier.mesh.position.z
            );
        }
    }
}

// Block Emitter class - fountain that launches blocks
class BlockEmitter {
    constructor(x, z) {
        // Create fountain base
        const baseGeometry = new THREE.CylinderGeometry(1, 1.5, 2, 8);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.8
        });
        this.baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
        this.baseMesh.position.set(x, 1, z);
        this.baseMesh.castShadow = true;
        this.baseMesh.receiveShadow = true;

        // Create fountain top/nozzle
        const nozzleGeometry = new THREE.CylinderGeometry(0.3, 0.5, 0.5, 8);
        const nozzleMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.6
        });
        this.nozzleMesh = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
        this.nozzleMesh.position.set(x, 2.25, z);
        this.nozzleMesh.castShadow = true;

        this.position = { x, z };
        this.collisionRadius = 1.5; // Match the base radius

        scene.add(this.baseMesh);
        scene.add(this.nozzleMesh);

        // Schedule first launch
        this.scheduleLaunch();
    }

    scheduleLaunch() {
        const delay = 10000 + Math.random() * 15000; // 10-25 seconds
        setTimeout(() => {
            this.launchBlock();
            this.scheduleLaunch();
        }, delay);
    }

    launchBlock() {
        // Create block at emitter position
        const block = new MovableBlock(this.position.x, this.position.z, true);
        block.mesh.position.y = 2.5; // Start at top of fountain

        // Calculate random landing position
        const landingRange = 25;
        const targetX = this.position.x + (Math.random() - 0.5) * landingRange;
        const targetZ = this.position.z + (Math.random() - 0.5) * landingRange;

        // Calculate initial velocity for a nice arc
        const dx = targetX - this.position.x;
        const dz = targetZ - this.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Launch parameters
        const flightTime = 1.5 + Math.random() * 0.5; // 1.5-2 seconds flight time
        const initialVelocityY = (-0.5 * block.gravity * flightTime);

        block.velocity.set(
            dx / flightTime,
            initialVelocityY,
            dz / flightTime
        );

        block.isFlying = true;

        // Add to blocks array
        blocks.push(block);

        console.log('Block fountain launched a new block!');
    }
}

// Create multiple movable blocks
const blocks = [];
const initialBlockCount = 3;

for (let i = 0; i < initialBlockCount; i++) {
    const x = (Math.random() - 0.5) * 30;
    const z = (Math.random() - 0.5) * 30;
    blocks.push(new MovableBlock(x, z));
}

// Create block emitter/fountain
const blockEmitter = new BlockEmitter(-15, -15);

// Create population of 10 creatures
const creatures = [];
const populationSize = 10;
const spawnRange = 20;

for (let i = 0; i < populationSize; i++) {
    const x = (Math.random() - 0.5) * spawnRange;
    const z = (Math.random() - 0.5) * spawnRange;
    const creature = new Creature(x, z);
    creatures.push(creature);
    taskManager.registerCreature(creature);
}

// Periodically create tasks to move blocks
function scheduleBlockMoveTask() {
    const delay = 3000 + Math.random() * 7000; // Random delay between 3-10 seconds
    setTimeout(() => {
        // Pick a random block that isn't being carried, eaten, or flying
        const availableBlocks = blocks.filter(block =>
            !block.isBeingCarried && !block.eaten && !block.isFlying
        );

        if (availableBlocks.length > 0) {
            const randomBlock = availableBlocks[Math.floor(Math.random() * availableBlocks.length)];
            const task = new Task('move_block', { block: randomBlock });
            taskManager.addTask(task);
        }

        scheduleBlockMoveTask();
    }, delay);
}

scheduleBlockMoveTask();

// VR Controllers
const controllers = [];
const controllerGrips = [];

for (let i = 0; i < 2; i++) {
    // Controller ray
    const controller = renderer.xr.getController(i);
    controller.addEventListener('selectstart', onSelectStart);
    controller.addEventListener('selectend', onSelectEnd);
    controller.addEventListener('squeezestart', onSqueezeStart);
    controller.addEventListener('squeezeend', onSqueezeEnd);
    controller.userData.index = i; // Store controller index
    controller.userData.isDragging = false;
    controller.userData.isGripping = false;
    controller.userData.lastPosition = new THREE.Vector3();
    scene.add(controller);
    controllers.push(controller);

    // Controller grip (visual representation)
    const controllerGrip = renderer.xr.getControllerGrip(i);

    // Add a simple sphere to show controller position
    const geometry = new THREE.SphereGeometry(0.05, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const sphere = new THREE.Mesh(geometry, material);
    controllerGrip.add(sphere);

    scene.add(controllerGrip);
    controllerGrips.push(controllerGrip);

    // Add line to show pointing direction
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.scale.z = 5;
    controller.add(line);
}

let selectedObject = null;

function onSelectStart(event) {
    const controller = event.target;

    // Raycast to find objects
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    const raycaster = new THREE.Raycaster();
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    // Check for block intersections
    const blockMeshes = blocks.filter(b => !b.eaten && !b.isBeingCarried).map(b => b.mesh);
    const intersects = raycaster.intersectObjects(blockMeshes);

    if (intersects.length > 0) {
        const intersectedMesh = intersects[0].object;
        const block = blocks.find(b => b.mesh === intersectedMesh);

        if (block && !block.isBeingCarried) {
            // Pick up the block
            selectedObject = block;
            block.isBeingCarried = true;
            controller.userData.selectedBlock = block;
        }
    } else {
        // No block hit - start camera panning mode
        controller.userData.isDragging = true;
        controller.userData.lastPosition.setFromMatrixPosition(controller.matrixWorld);
    }
}

function onSelectEnd(event) {
    const controller = event.target;

    if (controller.userData.selectedBlock) {
        const block = controller.userData.selectedBlock;

        // Get controller position and drop block there
        const position = new THREE.Vector3();
        position.setFromMatrixPosition(controller.matrixWorld);

        block.drop(position.x, position.z);
        block.isBeingCarried = false;

        controller.userData.selectedBlock = null;
        selectedObject = null;
    }

    // End camera panning
    controller.userData.isDragging = false;
}

function onSqueezeStart(event) {
    const controller = event.target;
    controller.userData.isGripping = true;
    controller.userData.lastPosition.setFromMatrixPosition(controller.matrixWorld);
}

function onSqueezeEnd(event) {
    const controller = event.target;
    controller.userData.isGripping = false;
}

// Update controller-held blocks
function updateVRControllers() {
    controllers.forEach(controller => {
        if (controller.userData.selectedBlock) {
            const block = controller.userData.selectedBlock;
            const position = new THREE.Vector3();
            position.setFromMatrixPosition(controller.matrixWorld);

            block.mesh.position.copy(position);
        }
    });
}

// Handle VR controller input for camera controls and locomotion
function handleVRControllerInput() {
    const session = renderer.xr.getSession();
    if (!session) return;

    // Get input sources (controllers)
    const inputSources = session.inputSources;

    for (let i = 0; i < inputSources.length; i++) {
        const inputSource = inputSources[i];
        const gamepad = inputSource.gamepad;
        const controller = controllers[i];

        if (!gamepad || !controller) continue;

        // VR locomotion when in VR presenting mode
        if (renderer.xr.isPresenting) {
            // Thumbstick locomotion
            if (gamepad.axes.length >= 4) {
                const thumbstickX = gamepad.axes[2] || 0; // Thumbstick X
                const thumbstickY = gamepad.axes[3] || 0; // Thumbstick Y

                // Get camera direction for forward movement
                const cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);
                cameraDirection.y = 0; // Keep movement on ground plane
                cameraDirection.normalize();

                // Get camera right direction for strafing
                const cameraRight = new THREE.Vector3();
                cameraRight.crossVectors(camera.up, cameraDirection).normalize();

                const moveSpeed = 0.1;

                // Forward/backward movement (thumbstick Y)
                if (Math.abs(thumbstickY) > 0.1) {
                    camera.position.add(cameraDirection.multiplyScalar(-thumbstickY * moveSpeed));
                }

                // Strafe left/right movement (thumbstick X)
                if (Math.abs(thumbstickX) > 0.1) {
                    camera.position.add(cameraRight.multiplyScalar(thumbstickX * moveSpeed));
                }
            }
        } else {
            // Non-VR mode camera controls
            // Both controllers have same controls:
            // Thumbstick: up/down = zoom, left/right = rotate
            if (gamepad.axes.length >= 4) {
                const thumbstickX = gamepad.axes[2] || 0; // Thumbstick X
                const thumbstickY = gamepad.axes[3] || 0; // Thumbstick Y

                // Rotate camera with horizontal thumbstick
                if (Math.abs(thumbstickX) > 0.1) {
                    cameraAngle += thumbstickX * 0.02;
                }

                // Zoom with vertical thumbstick
                if (Math.abs(thumbstickY) > 0.1) {
                    cameraDistance += thumbstickY * 0.5;
                    cameraDistance = Math.max(10, Math.min(100, cameraDistance));
                }
            }

            // Handle trigger drag for panning
            if (controller.userData.isDragging) {
                const currentPosition = new THREE.Vector3();
                currentPosition.setFromMatrixPosition(controller.matrixWorld);

                const delta = new THREE.Vector3().subVectors(
                    controller.userData.lastPosition,
                    currentPosition
                );

                // Scale the panning based on camera distance
                const panScale = cameraDistance * 0.5;

                // Transform delta to camera-relative coordinates
                const right = new THREE.Vector3(1, 0, 0);
                const forward = new THREE.Vector3(0, 0, -1);
                right.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);
                forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

                // Apply panning
                cameraTarget.add(right.multiplyScalar(delta.x * panScale));
                cameraTarget.add(forward.multiplyScalar(delta.z * panScale));

                controller.userData.lastPosition.copy(currentPosition);
            }

            // Handle grip for rotation
            if (controller.userData.isGripping) {
                const currentPosition = new THREE.Vector3();
                currentPosition.setFromMatrixPosition(controller.matrixWorld);

                const delta = new THREE.Vector3().subVectors(
                    currentPosition,
                    controller.userData.lastPosition
                );

                // Horizontal movement rotates camera
                cameraAngle += delta.x * 2.0;

                controller.userData.lastPosition.copy(currentPosition);
            }
        }
    }
}

// Camera controls
let isDraggingLeft = false;
let isDraggingRight = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraTarget = new THREE.Vector3(0, 0, 0);
let cameraDistance = 50;
let cameraAngle = Math.PI / 4; // 45 degrees
let cameraHeight = 30;

renderer.domElement.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (e.button === 0) {
        isDraggingLeft = true;
    } else if (e.button === 2) {
        isDraggingRight = true;
    }
    previousMousePosition = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        isDraggingLeft = false;
    } else if (e.button === 2) {
        isDraggingRight = false;
    }
});

renderer.domElement.addEventListener('mousemove', (e) => {
    if (isDraggingLeft) {
        // Pan camera
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        const panSpeed = 0.05;
        const right = new THREE.Vector3(1, 0, 0);
        const forward = new THREE.Vector3(0, 0, -1);

        right.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

        cameraTarget.add(right.multiplyScalar(-deltaX * panSpeed));
        cameraTarget.add(forward.multiplyScalar(deltaY * panSpeed));
    }

    if (isDraggingRight) {
        // Rotate camera
        const deltaX = e.clientX - previousMousePosition.x;
        cameraAngle += deltaX * 0.01;
    }

    previousMousePosition = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 2;
    cameraDistance += e.deltaY * zoomSpeed * 0.01;
    cameraDistance = Math.max(10, Math.min(100, cameraDistance));
});

renderer.domElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Update camera position based on controls
function updateCamera() {
    const x = cameraTarget.x + Math.sin(cameraAngle) * cameraDistance;
    const z = cameraTarget.z + Math.cos(cameraAngle) * cameraDistance;
    const y = cameraTarget.y + cameraHeight;

    camera.position.set(x, y, z);
    camera.lookAt(cameraTarget);
}

// Animation loop
let startTime = Date.now();

function animate() {
    const time = (Date.now() - startTime) * 0.001;

    // Remove eaten blocks from the array
    for (let i = blocks.length - 1; i >= 0; i--) {
        if (blocks[i].eaten) {
            blocks.splice(i, 1);
        }
    }

    // Update task manager
    taskManager.update();

    // Update all creatures
    creatures.forEach(creature => creature.update(time));

    // Handle collisions (simple approach, good enough for 10 creatures)
    creatures.forEach(creature => {
        creature.handleCollisions(creatures);
        // Check collision with fountain
        creature.checkFountainCollision(blockEmitter);
    });

    // Update all blocks (with delta time for physics)
    const deltaTime = 1 / 60; // Approximate 60 FPS
    blocks.forEach(block => {
        if (!block.eaten) {
            block.update(deltaTime);
        }
    });

    // Update VR controllers
    updateVRControllers();

    // Handle VR controller input for camera controls
    handleVRControllerInput();

    // Update camera (always update in non-VR presenting mode)
    if (!renderer.xr.isPresenting) {
        updateCamera();
    }

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation (use setAnimationLoop for VR compatibility)
renderer.setAnimationLoop(animate);
