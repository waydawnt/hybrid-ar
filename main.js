import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

//////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////

const hint = document.getElementById("hint");
const toggleBtn = document.getElementById("toggleInfo");
const infoPanel = document.getElementById("infoPanel");
const arContainer = document.getElementById("arContainer");

let lastHint = "";
function setHint(text){
  if(text === lastHint) return;
  lastHint = text;
  hint.textContent = text;
}

let infoVisible = false;
toggleBtn.addEventListener("click", () => {
  infoVisible = !infoVisible;
  infoPanel.style.display = infoVisible ? "block" : "none";
  toggleBtn.setAttribute("aria-expanded", String(infoVisible));
});
function showToggle(){
  toggleBtn.classList.add("show");
  toggleBtn.setAttribute("aria-hidden", "false");
}

//////////////////////////////////////////////////
// Scene + Camera + Renderer
//////////////////////////////////////////////////

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

const isLowEnd = (() => {
  try { return navigator.deviceMemory && navigator.deviceMemory <= 1; } catch (e) { return false; }
})();

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: !isLowEnd,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));

//////////////////////////////////////////////////
// Model loading (GLB for WebXR)
//////////////////////////////////////////////////

let ball = null;
const loader = new GLTFLoader();

loader.load(
  "model.glb",
  (gltf) => {
    ball = gltf.scene;
    ball.scale.setScalar(0.07);
    ball.visible = false;
    // Freeze transforms consistently for all nodes to avoid nested transform issues
    ball.traverse(o => o.matrixAutoUpdate = false);
    scene.add(ball);
    setHint("Move phone to detect surface");
  },
  undefined,
  (err) => {
    console.error("GLTF load error", err);
    setHint("Failed to load model");
  }
);

//////////////////////////////////////////////////
// Reticle (ring) for placement
//////////////////////////////////////////////////

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.006, 0.009, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, side: THREE.DoubleSide })
);
reticle.rotation.x = -Math.PI / 2;
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

//////////////////////////////////////////////////
// Placement logic
//////////////////////////////////////////////////

function placeBall(pos){
  if(!ball) return;
  ball.position.copy(pos);
  ball.updateMatrix();
  ball.updateMatrixWorld(true);
  ball.visible = true;
  showToggle();
  setHint("Ball placed — Tap Info");
}

const controller = renderer.xr.getController(0);
controller.addEventListener("select", (ev) => {
  // Only place when the last pointerdown was near the reticle (see pointerdown handler)
  if (reticle.visible && lastTapNearReticle) {
    const pos = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
    placeBall(pos);
    reticle.visible = false;
    lastTapNearReticle = false;
  }
});
scene.add(controller);

//////////////////////////////////////////////////
// Platform detection and AR entry
//////////////////////////////////////////////////

function isiOS(){
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

if (isiOS()) {
  const link = document.createElement("a");
  link.rel = "ar";
  link.href = "model.usdz"; // provide this file on your server

  // Optional preview image (include preview.jpg on server if used)
  const img = document.createElement("img");
  img.src = "preview.jpg";
  img.alt = "Therapy Ball preview";
  img.style.width = "200px";
  img.style.display = "block";
  img.style.marginBottom = "8px";

  const btn = document.createElement("button");
  btn.innerText = "View in AR";
  btn.style.padding = "12px 18px";
  btn.style.borderRadius = "10px";
  btn.style.border = "none";
  btn.style.fontWeight = "bold";

  // Append preview and button (preview optional)
  link.appendChild(img);
  link.appendChild(btn);
  arContainer.appendChild(link);
  setHint("Tap to open AR");
} else if (navigator.xr) {
  arContainer.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: ["local-floor"],
      optionalFeatures: ["hit-test", "dom-overlay"],
      domOverlay: { root: document.body }
    })
  );
} else {
  setHint("AR not supported on this device");
}

//////////////////////////////////////////////////
// Hit test lifecycle and cleanup
//////////////////////////////////////////////////

let hitSource = null;

renderer.xr.addEventListener('sessionstart', async () => {
  const session = renderer.xr.getSession();
  session.addEventListener('end', onSessionEnded);
  try {
    const viewerSpace = await session.requestReferenceSpace('viewer');
    hitSource = await session.requestHitTestSource({ space: viewerSpace });
  } catch (err) {
    console.warn('Hit test not available', err);
  }
});

function onSessionEnded() {
  if (hitSource) {
    try { hitSource.cancel(); } catch (e) {}
    hitSource = null;
  }
  reticle.visible = false;
  setHint('Tap ENTER AR');
}

//////////////////////////////////////////////////
// Pointer-based placement guard
//////////////////////////////////////////////////

// Flag set when a pointerdown occurs near the reticle projection
let lastTapNearReticle = false;
const TAP_THRESHOLD_PX = 40; // pixels; adjust to taste

// Reusable vectors to avoid allocations
const _vReticleWorld = new THREE.Vector3();
const _vProjected = new THREE.Vector3();

renderer.domElement.addEventListener('pointerdown', (e) => {
  // Only consider primary button / primary touch
  if (e.button && e.button !== 0) return;

  if (!reticle.visible) {
    lastTapNearReticle = false;
    return;
  }

  // Canvas rect (handles full-window canvas or positioned canvas)
  const rect = renderer.domElement.getBoundingClientRect();

  // Get reticle world position and project to NDC
  _vReticleWorld.setFromMatrixPosition(reticle.matrix);
  _vProjected.copy(_vReticleWorld).project(camera);

  // Convert NDC to screen coordinates relative to page
  const screenX = ( _vProjected.x + 1 ) / 2 * rect.width + rect.left;
  const screenY = ( -_vProjected.y + 1 ) / 2 * rect.height + rect.top;

  const dx = e.clientX - screenX;
  const dy = e.clientY - screenY;
  const dist = Math.hypot(dx, dy);

  lastTapNearReticle = dist <= TAP_THRESHOLD_PX;

  // Clear the flag shortly after to avoid stale state
  setTimeout(() => { lastTapNearReticle = false; }, 250);
}, { passive: true });

//////////////////////////////////////////////////
// Render loop with hit testing
//////////////////////////////////////////////////

renderer.setAnimationLoop((time, frame) => {
  if (frame) {
    const refSpace = renderer.xr.getReferenceSpace();
    if (hitSource && refSpace) {
      const hits = frame.getHitTestResults(hitSource);
      if (hits.length) {
        const pose = hits[0].getPose(refSpace);
        if (pose) {
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
          setHint("Tap dot to place");
        } else {
          reticle.visible = false;
          setHint("Move phone to detect surface");
        }
      } else {
        reticle.visible = false;
        setHint("Move phone to detect surface");
      }
    }
  }

  renderer.render(scene, camera);
});

//////////////////////////////////////////////////
// Resize and cleanup
//////////////////////////////////////////////////

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("pagehide", () => {
  try {
    const session = renderer.xr.getSession();
    if (session) session.end();
  } catch (e) {}
});