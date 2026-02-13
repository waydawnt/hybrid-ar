// main.js - robust Three.js WebXR AR starter
import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";


const hintEl = document.getElementById("hint");
const arContainer = document.getElementById("arContainer");

function hint(msg){
  console.log("[AR]", msg);
  hintEl.textContent = msg;
}

/* Scene + renderer */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;

/* Ensure the canvas is background layer (z-index 0). */
const canvas = renderer.domElement;
canvas.style.zIndex = "0";

/* Append canvas AFTER we build the AR button below so UI sits above */
document.body.appendChild(canvas);

/* simple lighting */
scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));

/* load model (model.glb must be in same folder and reachable via HTTPS) */
let model = null;
new GLTFLoader().load(
  'model.glb',
  gltf => {
    model = gltf.scene;
    model.scale.set(0.35,0.35,0.35);
    model.visible = false;
    scene.add(model);
    hint("Model loaded — open AR");
  },
  undefined,
  err => {
    console.error("GLTF load error:", err);
    hint("Model load failed (check path)");
  }
);

/* reticle for hit-test */
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.08, 0.10, 32).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({ color: 0x00aaff })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

/* fallback placement (1.5m in front of camera) */
function placeFallbackImmediately(){
  if(!model) return;
  const cam = renderer.xr.getCamera(camera);
  // camera may be stereo group; use its position/quaternion
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  cam.getWorldPosition(pos);
  cam.getWorldQuaternion(quat);

  const forward = new THREE.Vector3(0,0,-1).applyQuaternion(quat).multiplyScalar(1.5);
  model.position.copy(pos).add(forward);
  model.quaternion.copy(quat);
  model.visible = true;
  hint("Placed (fallback). Move phone to scan.");
}

/* controller selection (tap) */
const controller = renderer.xr.getController(0);
controller.addEventListener('select', () => {
  if (reticle.visible && model) {
    model.position.setFromMatrixPosition(reticle.matrix);
    model.visible = true;
    hint("Placed on surface");
  } else {
    hint("No surface — move phone or use fallback");
  }
});
scene.add(controller);

/* Create the real ARButton and style it, then put it in arContainer.
   Important: ARButton.createButton creates a button that starts XR via a trusted gesture.
*/
const arButton = ARButton.createButton(renderer, {
  requiredFeatures: ['local-floor'],   // minimal required
  optionalFeatures: ['hit-test']      // enable hit-test if available
});

/* Style the produced button so it looks like your UI and is always on top */
arButton.style.display = "";
arButton.style.padding = "12px 20px";
arButton.style.fontSize = "16px";
arButton.style.fontWeight = "700";
arButton.style.borderRadius = "10px";
arButton.style.background = "#00d0c0";
arButton.style.color = "#002";
arButton.style.border = "none";
arButton.style.cursor = "pointer";
arButton.style.zIndex = "4000";
arButton.style.pointerEvents = "auto";

/* Some browsers return an <a> (link) instead of a button when XR unsupported.
   Keep it visible so users see instructions (link may point to 'https://immersiveweb.dev').
*/
arContainer.appendChild(arButton);

/* XR state for hit-test */
let hitTestSource = null;
let hitTestSourceRequested = false;

/* Main render loop */
renderer.setAnimationLoop((time, frame) => {
  if (frame) {
    const session = renderer.xr.getSession();
    const referenceSpace = renderer.xr.getReferenceSpace();

    // request hit-test source once per session (safe-guarded)
    if (session && !hitTestSourceRequested) {
      hitTestSourceRequested = true;

      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
          console.log('hitTestSource ready');
        }).catch(err => {
          console.warn('requestHitTestSource failed', err);
        });
      }).catch(err => {
        console.warn('requestReferenceSpace(viewer) failed', err);
      });

      // ensure fallback placement soon after session starts
      setTimeout(() => {
        try { placeFallbackImmediately(); } catch(e) { console.warn(e); }
      }, 700);
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
        if (pose) {
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
          hint("Surface detected — tap to place");
        }
      } else {
        reticle.visible = false;
        hint("Scanning for surfaces...");
      }
    }
  }

  renderer.render(scene, camera);
});

/* Clean up hitTest when session ends (avoid stale sources) */
function onSessionEnd() {
  if (hitTestSource) {
    try { hitTestSource.cancel(); } catch(e){}
    hitTestSource = null;
  }
  hitTestSourceRequested = false;
  reticle.visible = false;
  if (model) model.visible = false;
  hint("Session ended — open AR again");
}

/* Attach session end handler after ARButton creates the session - listen to global XR sessions */
navigator.xr && navigator.xr.addEventListener && navigator.xr.addEventListener('sessionend', onSessionEnd);

/* Window resize */
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});
