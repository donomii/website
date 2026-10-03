import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const DEFAULT_OPTIONS = Object.freeze({
    groundY: 0,
    mapLimit: 48,
    minDistance: 8,
    maxDistance: 120,
    minElevation: THREE.MathUtils.degToRad(15),
    maxElevation: THREE.MathUtils.degToRad(75),
    rotateSpeed: 0.005,
    zoomSpeed: 0.0015
});

export class RTSCameraControls {
    constructor(camera, element, options = {}) {
        this.camera = camera;
        this.element = element;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.target = this.options.target ?? new THREE.Vector3(0, this.options.groundY, 0);
        this.enabled = true;

        const offset = camera.position.clone().sub(this.target);
        this.distance = THREE.MathUtils.clamp(
            offset.length(),
            this.options.minDistance,
            this.options.maxDistance
        );
        this.azimuthAngle = Math.atan2(offset.x, offset.z);
        this.elevationAngle = THREE.MathUtils.clamp(
            Math.asin(THREE.MathUtils.clamp(offset.y / this.distance, -1, 1)),
            this.options.minElevation,
            this.options.maxElevation
        );

        this.dragMode = 'idle';
        this.activePointerId = null;
        this.previousPointer = new THREE.Vector2();
        this.pointerNdc = new THREE.Vector2();
        this.panAnchor = new THREE.Vector3();
        this.groundDelta = new THREE.Vector3();
        this.groundPoint = new THREE.Vector3();
        this.zoomPointBefore = new THREE.Vector3();
        this.zoomPointAfter = new THREE.Vector3();
        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(
            new THREE.Vector3(0, 1, 0),
            -this.options.groundY
        );

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerEnd = this.onPointerEnd.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);

        element.style.cursor = 'grab';
        element.style.touchAction = 'none';
        element.addEventListener('pointerdown', this.onPointerDown);
        element.addEventListener('pointermove', this.onPointerMove);
        element.addEventListener('pointerup', this.onPointerEnd);
        element.addEventListener('pointercancel', this.onPointerEnd);
        element.addEventListener('lostpointercapture', this.onPointerEnd);
        element.addEventListener('wheel', this.onWheel, { passive: false });
        element.addEventListener('contextmenu', this.onContextMenu);

        this.updateCamera();
    }

    onPointerDown(event) {
        event.preventDefault();
        if (this.enabled) {
            switch (event.button) {
                case 0:
                case 1:
                    this.beginGroundPan(event);
                    break;
                case 2:
                    this.beginOrbit(event);
                    break;
                default:
                    this.cancelInteraction();
                    break;
            }
        } else {
            this.cancelInteraction();
        }
    }

    beginGroundPan(event) {
        const intersection = this.pointerGroundIntersection(event, this.groundPoint);
        if (intersection === null) {
            this.cancelInteraction();
        } else {
            this.panAnchor.copy(intersection);
            this.beginInteraction(event, 'pan');
        }
    }

    beginOrbit(event) {
        this.beginInteraction(event, 'orbit');
    }

    beginInteraction(event, mode) {
        this.dragMode = mode;
        this.activePointerId = event.pointerId;
        this.previousPointer.set(event.clientX, event.clientY);
        if (typeof this.element.setPointerCapture === 'function') {
            this.element.setPointerCapture(event.pointerId);
        } else {
            window.addEventListener('pointermove', this.onPointerMove);
            window.addEventListener('pointerup', this.onPointerEnd);
            window.addEventListener('pointercancel', this.onPointerEnd);
        }
        this.updateCursor();
    }

    onPointerMove(event) {
        if (event.pointerId === this.activePointerId) {
            this.moveActivePointer(event);
        } else {
            this.updateCursor();
        }
    }

    moveActivePointer(event) {
        event.preventDefault();
        switch (this.dragMode) {
            case 'pan':
                this.dragGround(event);
                break;
            case 'orbit':
                this.dragOrbit(event);
                break;
            default:
                this.previousPointer.set(event.clientX, event.clientY);
                break;
        }
    }

    dragGround(event) {
        const intersection = this.pointerGroundIntersection(event, this.groundPoint);
        if (intersection === null) {
            this.previousPointer.set(event.clientX, event.clientY);
        } else {
            this.target.add(this.groundDelta.subVectors(this.panAnchor, intersection));
            this.clampTarget();
            this.updateCamera();
        }
    }

    dragOrbit(event) {
        const deltaX = event.clientX - this.previousPointer.x;
        const deltaY = event.clientY - this.previousPointer.y;
        this.rotate(deltaX * this.options.rotateSpeed, deltaY * this.options.rotateSpeed);
        this.previousPointer.set(event.clientX, event.clientY);
    }

    onPointerEnd(event) {
        if (event.pointerId === this.activePointerId) {
            event.preventDefault();
            this.cancelInteraction();
        } else {
            this.updateCursor();
        }
    }

    onWheel(event) {
        event.preventDefault();
        if (this.enabled) {
            this.zoomTowardPointer(event);
        } else {
            this.cancelInteraction();
        }
    }

    zoomTowardPointer(event) {
        const before = this.pointerGroundIntersection(event, this.zoomPointBefore);
        const zoomFactor = Math.exp(event.deltaY * this.options.zoomSpeed);
        this.distance = THREE.MathUtils.clamp(
            this.distance * zoomFactor,
            this.options.minDistance,
            this.options.maxDistance
        );
        this.updateCamera();
        const after = this.pointerGroundIntersection(event, this.zoomPointAfter);

        if (before === null || after === null) {
            this.updateCamera();
        } else {
            this.target.add(this.groundDelta.subVectors(before, after));
            this.clampTarget();
            this.updateCamera();
        }
    }

    onContextMenu(event) {
        event.preventDefault();
    }

    pointerGroundIntersection(event, result) {
        const bounds = this.element.getBoundingClientRect();
        this.pointerNdc.set(
            ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
            -((event.clientY - bounds.top) / bounds.height) * 2 + 1
        );
        this.raycaster.setFromCamera(this.pointerNdc, this.camera);
        return this.raycaster.ray.intersectPlane(this.groundPlane, result);
    }

    rotate(azimuthDelta, elevationDelta) {
        this.azimuthAngle += azimuthDelta;
        this.elevationAngle = THREE.MathUtils.clamp(
            this.elevationAngle + elevationDelta,
            this.options.minElevation,
            this.options.maxElevation
        );
        this.updateCamera();
    }

    changeDistance(delta) {
        this.distance = THREE.MathUtils.clamp(
            this.distance + delta,
            this.options.minDistance,
            this.options.maxDistance
        );
        this.updateCamera();
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled) {
            this.updateCamera();
            this.updateCursor();
        } else {
            this.cancelInteraction();
        }
    }

    clampTarget() {
        this.target.x = THREE.MathUtils.clamp(
            this.target.x,
            -this.options.mapLimit,
            this.options.mapLimit
        );
        this.target.y = this.options.groundY;
        this.target.z = THREE.MathUtils.clamp(
            this.target.z,
            -this.options.mapLimit,
            this.options.mapLimit
        );
    }

    updateCamera() {
        this.clampTarget();
        const horizontalDistance = Math.cos(this.elevationAngle) * this.distance;
        cameraPositionFromOrbit(
            this.camera.position,
            this.target,
            horizontalDistance,
            this.distance,
            this.azimuthAngle,
            this.elevationAngle
        );
        this.camera.lookAt(this.target);
        this.camera.updateMatrixWorld();
    }

    cancelInteraction() {
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerup', this.onPointerEnd);
        window.removeEventListener('pointercancel', this.onPointerEnd);
        this.dragMode = 'idle';
        this.activePointerId = null;
        this.updateCursor();
    }

    updateCursor() {
        if (this.enabled) {
            switch (this.dragMode) {
                case 'pan':
                    this.element.style.cursor = 'grabbing';
                    break;
                case 'orbit':
                    this.element.style.cursor = 'move';
                    break;
                default:
                    this.element.style.cursor = 'grab';
                    break;
            }
        } else {
            this.element.style.cursor = 'default';
        }
    }
}

function cameraPositionFromOrbit(position, target, horizontalDistance, distance, azimuth, elevation) {
    position.set(
        target.x + Math.sin(azimuth) * horizontalDistance,
        target.y + Math.sin(elevation) * distance,
        target.z + Math.cos(azimuth) * horizontalDistance
    );
}
