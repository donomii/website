import * as THREE from './three.module.js';

// Color only the triangle edges. The depth pass hides edges behind nearer surfaces.
const depth = new THREE.MeshBasicMaterial({
  colorWrite: false, side: THREE.DoubleSide, polygonOffset: true,
  polygonOffsetFactor: 1, polygonOffsetUnits: 1
});
const wire = new THREE.MeshBasicMaterial({
  color: 0x77ffc7, wireframe: true, transparent: true, opacity: 0.72, depthWrite: false
});
const outline = new THREE.LineBasicMaterial({ color: 0x9fffd6, depthWrite: false });
const empty = new Set();

function labelText(value) {
  const name = (value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  return ['', 'other', 'unknown', 'unrecognized', 'global mesh', 'scene mesh'].includes(name)
    ? '' : name.charAt(0).toUpperCase() + name.slice(1);
}

export function makeSign(lines, height) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '600 40px system-ui, sans-serif';
  ctx.font = font;
  canvas.width = Math.ceil(Math.max(...lines.map(line => ctx.measureText(line).width))) + 42;
  canvas.height = 20 + 54 * lines.length;
  ctx.font = font;
  ctx.fillStyle = '#102521';
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 13);
  ctx.fill();
  ctx.fillStyle = '#edfff2';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => ctx.fillText(line, 21, 37 + 54 * i));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, depthTest: false, depthWrite: false, toneMapped: false
  }));
  sign.scale.set(height * canvas.width / canvas.height, height, 1);
  sign.renderOrder = 3;
  return sign;
}

export function releaseSign(sign) {
  sign.removeFromParent();
  sign.material.map.dispose();
  sign.material.dispose();
}

function attachLabel(geometry, group, text) {
  if (text && geometry.attributes.position.count) {
    const sign = makeSign([text], 0.085);
    geometry.computeBoundingBox();
    geometry.boundingBox.getCenter(sign.position);
    group.add(sign);
    return sign;
  } else {
    return null;
  }
}

function buildSurface(source, mesh) {
  const geometry = new THREE.BufferGeometry();
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  if (mesh) {
    geometry.setAttribute('position', new THREE.BufferAttribute(source.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(source.indices, 1));
    group.add(new THREE.Mesh(geometry, depth), new THREE.Mesh(geometry, wire));
  } else {
    geometry.setFromPoints(source.polygon);
    group.add(new THREE.LineLoop(geometry, outline));
  }
  const sign = attachLabel(geometry, group, labelText(source.semanticLabel));
  return { group, geometry, sign, changed: source.lastChangedTime };
}

function removeSurface(surface) {
  surface.group.removeFromParent();
  surface.geometry.dispose();
  if (surface.sign) {
    releaseSign(surface.sign);
  } else {
    return;
  }
}

export class RoomScene {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map();
    this.planes = new Map();
  }

  updateSet(cache, detected, frame, space, mesh) {
    let visible = 0;
    for (const [source, surface] of cache) {
      if (detected.has(source) && surface.changed === source.lastChangedTime) {
        continue;
      } else {
        removeSurface(surface);
        cache.delete(source);
      }
    }
    for (const source of detected) {
      let surface;
      if (cache.has(source)) {
        surface = cache.get(source);
      } else {
        surface = buildSurface(source, mesh);
        cache.set(source, surface);
        this.scene.add(surface.group);
      }
      const pose = frame.getPose(mesh ? source.meshSpace : source.planeSpace, space);
      surface.group.visible = Boolean(pose);
      if (pose) {
        surface.group.matrix.fromArray(pose.transform.matrix);
        surface.group.matrixWorldNeedsUpdate = true;
        visible += Number(surface.geometry.attributes.position.count > 0);
      } else {
        continue;
      }
    }
    return visible;
  }

  update(frame, space) {
    const meshCount = this.updateSet(this.meshes, frame.detectedMeshes ?? empty, frame, space, true);
    const planeCount = this.updateSet(this.planes, frame.detectedPlanes ?? empty, frame, space, false);
    return meshCount + planeCount;
  }

  clear() {
    for (const cache of [this.meshes, this.planes]) {
      cache.forEach(removeSurface);
      cache.clear();
    }
  }
}
