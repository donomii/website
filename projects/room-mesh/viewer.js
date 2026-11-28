import * as THREE from './three.module.js';
import { RoomScene, makeSign, releaseSign } from './scene.js';

const start = document.querySelector('#start');
const status = document.querySelector('#status');
const scene = new THREE.Scene();
const room = new RoomScene(scene);
const camera = new THREE.PerspectiveCamera(65, 1, 0.03, 100);
const viewMatrix = new THREE.Matrix4();
let renderer;
let active;

function errorMessage(error) {
  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Access was denied. Allow spatial data for this site in Quest Browser, then try again.';
    case 'NotSupportedError':
      return 'This browser could not start room detection. Use Quest Browser on a headset with a saved room scan.';
    default:
      return 'Could not show your room. ' + error.message;
  }
}

function getRenderer() {
  if (renderer) {
    return renderer;
  } else {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(1, 1, false);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    return renderer;
  }
}

function clearNotice(state) {
  if (state.notice) {
    releaseSign(state.notice);
    state.notice = null;
    state.message = '';
  } else {
    return;
  }
}

function showNotice(state, lines, pose) {
  const message = lines.join('\n');
  if (state.message !== message) {
    clearNotice(state);
    state.notice = makeSign(lines, lines.length * 0.075);
    state.message = message;
    scene.add(state.notice);
  } else {
    state.notice.visible = true;
  }
  viewMatrix.fromArray(pose.transform.matrix);
  state.notice.position.set(0, -0.13, -1.3).applyMatrix4(viewMatrix);
}

function finish(state) {
  if (active !== state) {
    return;
  } else {
    active = null;
    renderer?.setAnimationLoop(null);
    clearNotice(state);
    room.clear();
    start.disabled = false;
    start.textContent = 'Show my room';
    status.textContent = state.endMessage || 'Room view closed.';
  }
}

async function stopSession(state, message) {
  state.endMessage = message;
  try {
    await state.session.end();
  } catch (error) {
    state.endMessage += ' ' + error.message;
  } finally {
    finish(state);
  }
}

async function captureRoom(state) {
  if (!state.canCapture || state.captureStarted) {
    return;
  } else {
    state.captureStarted = true;
    try {
      await state.session.initiateRoomCapture();
    } catch (error) {
      state.captureError = error.message;
      console.warn('Quest Space Setup could not start.', error);
    }
  }
}

function drawFrame(state, time, frame) {
  const space = renderer.xr.getReferenceSpace();
  const pose = frame.getViewerPose(space);
  if (!pose) {
    return;
  } else {
    const visible = room.update(frame, space);
    state.firstFrame ??= time;
    const waited = time - state.firstFrame;
    state.canCapture = visible === 0 && waited > 3000 && typeof state.session.initiateRoomCapture === 'function';
    if (visible || waited <= 3000) {
      clearNotice(state);
    } else if (state.canCapture && !state.captureStarted) {
      showNotice(state, ['No room scan visible.', 'Pinch or pull the trigger for Space Setup.'], pose);
    } else {
      showNotice(state, [state.captureError ? 'Room setup could not start.' : 'Waiting for a room scan.',
        'Finish Space Setup and allow spatial data.'], pose);
    }
    renderer.render(scene, camera);
  }
}

async function launch() {
  start.disabled = true;
  if (active) {
    await stopSession(active, 'Room view closed.');
  } else {
    status.textContent = 'Opening passthrough…';
    let state;
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        optionalFeatures: ['mesh-detection', 'plane-detection', 'layers']
      });
      state = { session, message: '', canCapture: false, captureStarted: false };
      active = state;
      session.addEventListener('end', () => finish(state), { once: true });
      session.addEventListener('select', () => captureRoom(state));
      const features = session.enabledFeatures;
      if (features && !['mesh-detection', 'plane-detection'].some(feature => features.includes(feature))) {
        await stopSession(state, 'Room data is unavailable. Allow spatial data in site permissions, then try again.');
      } else {
        await getRenderer().xr.setSession(session);
        if (active !== state) {
          return;
        } else {
          start.textContent = 'Close room view';
          start.disabled = false;
          status.textContent = 'Room view open.';
          renderer.setAnimationLoop((time, frame) => {
            if (frame && active === state) {
              try {
                drawFrame(state, time, frame);
              } catch (error) {
                renderer.setAnimationLoop(null);
                void stopSession(state, errorMessage(error));
              }
            } else {
              return;
            }
          });
        }
      }
    } catch (error) {
      if (state) {
        await stopSession(state, errorMessage(error));
      } else {
        status.textContent = errorMessage(error);
        start.disabled = false;
      }
    }
  }
}

async function checkSupport() {
  try {
    if (!window.isSecureContext) {
      status.textContent = 'Open this page over HTTPS to use WebXR.';
    } else if (await navigator.xr?.isSessionSupported('immersive-ar')) {
      status.textContent = '';
      start.disabled = false;
    } else {
      status.textContent = 'Open this page in Meta Quest Browser to enter passthrough.';
    }
  } catch (error) {
    status.textContent = errorMessage(error);
  }
}

start.addEventListener('click', launch);
checkSupport();
