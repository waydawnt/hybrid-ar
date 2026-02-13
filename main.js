import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

//// UI helpers ////
const hint = document.getElementById("hint");
const toggleBtn = document.getElementById("toggleInfo");

let lastHint = "";
function log(msg){
  if(msg === lastHint) return;
  lastHint = msg;
  console.log("[AR]", msg);
  hint.textContent = msg;
}

let infoVisible = false;
function showToggle(){ toggleBtn.classList.add("show"); }
function hideToggle(){ toggleBtn.classList.remove("show"); }

// start hidden
hideToggle();

////////////////////////////////////////////////
// Scene + renderer
////////////////////////////////////////////////
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
const renderer = new THREE.WebGLRenderer({
  antialias:false,
  alpha:true,
  powerPreference:"high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0xbbbbff,1));

////////////////////////////////////////////////
// Model (therapy ball)
////////////////////////////////////////////////
let ball = null;
new GLTFLoader().load("model.glb",
  (gltf) => {
    ball = gltf.scene;
    // real-world diameter ~7cm: scale model such that it measures ~0.07m in diameter.
    // using setScalar assumes model was exported with a 1-unit = 1m convention; adjust if needed.
    ball.scale.setScalar(0.07);
    ball.visible = false;
    ball.traverse(o => { o.matrixAutoUpdate = false; });
    scene.add(ball);
    log("Model ready — Enter AR");
  },
  undefined,
  (err) => {
    console.error("Model load error", err);
    log("Model load failed (check model.glb path)");
  }
);

////////////////////////////////////////////////
// Info panel (filled rounded rectangle + border + text)
////////////////////////////////////////////////
function createInfoPanel(){
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Clear
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Draw rounded filled background
  const pad = 28;
  const w = canvas.width - pad*2;
  const h = canvas.height - pad*2;
  const r = 28;

  ctx.fillStyle = "rgba(255,255,255,0.96)"; // near-opaque white fill
  ctx.beginPath();
  ctx.moveTo(pad+r, pad);
  ctx.arcTo(pad+w, pad, pad+w, pad+r, r);
  ctx.arcTo(pad+w, pad+h, pad+w-r, pad+h, r);
  ctx.arcTo(pad, pad+h, pad, pad+h-r, r);
  ctx.arcTo(pad, pad, pad+r, pad, r);
  ctx.closePath();
  ctx.fill();

  // border
  ctx.strokeStyle = "#00aaff";
  ctx.lineWidth = 12;
  ctx.stroke();

  // text
  ctx.fillStyle = "#0a2130"; // dark navy for good contrast on white
  ctx.font = "700 36px system-ui, sans-serif";
  ctx.textBaseline = "top";

  const lines = [
    "Latex free — compact & portable",
    "Blunt spikes for better grip",
    "Eco friendly tension relief",
    "Safe for sensitive skin"
  ];

  const textX = pad + 40;
  let textY = pad + 28;
  const lineHeight = 72;

  lines.forEach(line => {
    // wrap / clip not necessary for these short lines
    ctx.fillText(line, textX, textY);
    textY += lineHeight;
  });

  // subtle inner highlight for readability (tiny shadow)
  // (canvas text already readable due to fill)

  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  tex.needsUpdate = true;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.18),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );

  return mesh;
}

const infoPanel = createInfoPanel();
infoPanel.visible = false;
scene.add(infoPanel);

////////////////////////////////////////////////
// Tiny dot reticle (small & neat)
////////////////////////////////////////////////
let reticleTimer = null;
const reticle = new THREE.Mesh(
  new THREE.CircleGeometry(0.006, 24),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.9 })
);
reticle.rotation.x = -Math.PI/2;
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

////////////////////////////////////////////////
// Placement helpers
////////////////////////////////////////////////
function placeBall(position, quaternion){
  if(!ball) return;

  ball.position.copy(position);
  ball.quaternion.copy(quaternion);
  ball.updateMatrix();

  // place panel to RIGHT side at a comfortable distance from ball
  const offset = new THREE.Vector3(0.22, 0.006, 0); // 22 cm to right, 6 mm up
  infoPanel.position.copy(ball.position).add(offset);

  // keep panel flat on surface but rotate around Y to face user
  const dx = camera.position.x - infoPanel.position.x;
  const dz = camera.position.z - infoPanel.position.z;
  const angleY = Math.atan2(dx, dz); // compute heading toward camera
  infoPanel.rotation.set(-Math.PI/2, angleY, 0);

  infoPanel.visible = infoVisible && !!ball.visible;
  ball.visible = true;

  reticle.visible = false;

  // show toggle after placement
  showToggle();
}

function placeFallback(){
  if(!renderer.xr.isPresenting) {
    // still safe to calculate camera pose even if not in session,
    // but ordinarily we call fallback after session starts.
  }
  const cam = renderer.xr.getCamera(camera);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  cam.getWorldPosition(pos);
  cam.getWorldQuaternion(quat);
  const forward = new THREE.Vector3(0,0,-1).applyQuaternion(quat).multiplyScalar(0.4);
  pos.add(forward);
  placeBall(pos, quat);
  log("Placed (fallback)");
}

////////////////////////////////////////////////
// Controller / tap placement
////////////////////////////////////////////////
const controller = renderer.xr.getController(0);
controller.addEventListener("select", ()=>{
  if(reticle.visible && ball){
    const pos = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
    placeBall(pos, new THREE.Quaternion());
    log("Placed on surface");
  } else {
    log("No surface — move phone or wait");
  }
});
scene.add(controller);

////////////////////////////////////////////////
// ARButton + DOM overlay
////////////////////////////////////////////////
const btn = ARButton.createButton(renderer, {
  requiredFeatures: ["local-floor"],
  optionalFeatures: ["hit-test","dom-overlay"],
  domOverlay: { root: document.body }
});
document.getElementById("arContainer").appendChild(btn);

////////////////////////////////////////////////
// Toggle action (only after placement)
////////////////////////////////////////////////
toggleBtn.addEventListener("click", ()=>{
  if(!ball || !ball.visible) return;
  infoVisible = !infoVisible;
  infoPanel.visible = infoVisible;
});

////////////////////////////////////////////////
// Hit-test loop
////////////////////////////////////////////////
let hitSource = null;
let hitRequested = false;

renderer.setAnimationLoop((time, frame) => {
  if(frame){
    const session = renderer.xr.getSession();
    const refSpace = renderer.xr.getReferenceSpace();

    if(session && !hitRequested){
      hitRequested = true;
      session.requestReferenceSpace('viewer').then((viewerSpace)=>{
        session.requestHitTestSource({ space: viewerSpace }).then((src)=>{
          hitSource = src;
        }).catch(err=>{
          console.warn('hitTestSource failed', err);
        });
      }).catch(err=>{
        console.warn('viewer ref space failed', err);
      });

      // small fallback show so user sees model quickly
      setTimeout(()=>{ try{ placeFallback(); }catch(e){console.warn(e);} }, 700);
    }

    if(hitSource){
      const hits = frame.getHitTestResults(hitSource);
      if(hits.length > 0){
        const pose = hits[0].getPose(refSpace);
        if(pose){
          reticle.matrix.fromArray(pose.transform.matrix);
          if(!reticle.visible){
            reticle.visible = true;
            if(reticleTimer) clearTimeout(reticleTimer);
            reticleTimer = setTimeout(()=>{ reticle.visible = false; }, 500);
          }
        }
      } else {
        reticle.visible = false;
        log("Scanning…");
      }
    }
  }

  renderer.render(scene, camera);
});

////////////////////////////////////////////////
// Session cleanup & resize
////////////////////////////////////////////////
function onSessionEnd(){
  hitRequested = false;
  if(hitSource){ try{ hitSource.cancel(); }catch(e){} hitSource = null; }
  reticle.visible = false;
  infoPanel.visible = false;
  hideToggle();
  lastHint = "";
  log("Session ended");
}
if(navigator.xr && navigator.xr.addEventListener){
  navigator.xr.addEventListener('sessionend', onSessionEnd);
}

window.addEventListener("resize", ()=>{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
