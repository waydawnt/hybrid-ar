import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

//////////////////////////////////////////////////////
// UI helpers
//////////////////////////////////////////////////////

const hint = document.getElementById("hint");
const toggleBtn = document.getElementById("toggleInfo");

function log(msg){
  console.log("[AR]", msg);
  hint.textContent = msg;
}

let infoVisible = false;

function showToggle(){
  toggleBtn.style.opacity = 1;
  toggleBtn.style.pointerEvents = "auto";
}

function hideToggle(){
  toggleBtn.style.opacity = 0;
  toggleBtn.style.pointerEvents = "none";
}

hideToggle();


toggleBtn.onclick = () => {
  if(!ball || !ball.visible) return;
  infoVisible = !infoVisible;
  infoPanel.visible = infoVisible;
};

//////////////////////////////////////////////////////
// Scene + renderer
//////////////////////////////////////////////////////

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

//////////////////////////////////////////////////////
// Therapy ball
//////////////////////////////////////////////////////

let ball;

new GLTFLoader().load("model.glb",(gltf)=>{

  ball = gltf.scene;
  ball.scale.setScalar(0.07);
  ball.visible = false;

  ball.traverse(o=>o.matrixAutoUpdate=false);

  scene.add(ball);

  log("Model ready — enter AR");

});

//////////////////////////////////////////////////////
// Clean info card
//////////////////////////////////////////////////////

function createInfoPanel(){

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");

  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.font = "bold 32px sans-serif";

  const lines = [
    "Latex free — compact & portable",
    "Blunt spikes for better grip",
    "Eco friendly tension relief",
    "Safe for sensitive skin"
  ];

  lines.forEach((line,i)=>{

    const y = 80 + i*100;

    // glow outline
    ctx.strokeStyle = "rgba(0,170,255,0.8)";
    ctx.lineWidth = 6;
    ctx.strokeText(line,40,y);

    // main text
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line,40,y);

  });

  const tex = new THREE.CanvasTexture(canvas);

  return new THREE.Mesh(
    new THREE.PlaneGeometry(0.34,0.17),
    new THREE.MeshBasicMaterial({
      map:tex,
      transparent:true
    })
  );
}

const infoPanel = createInfoPanel();
infoPanel.visible = false;
scene.add(infoPanel);

//////////////////////////////////////////////////////
// Reticle
//////////////////////////////////////////////////////

let reticleTimer = null;

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(.06,.08,32).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({
    color:0xffffff,
    transparent:true,
    opacity:.35
  })
);

reticle.matrixAutoUpdate=false;
reticle.visible=false;

scene.add(reticle);

//////////////////////////////////////////////////////
// Placement helpers
//////////////////////////////////////////////////////

function placeBall(position, quaternion){
  if(!ball) return;

  ball.position.copy(position);
  ball.quaternion.copy(quaternion);
  ball.updateMatrix();

  // place panel to RIGHT side
  const offset = new THREE.Vector3(.18,0.003,0);

  infoPanel.position.copy(ball.position).add(offset);

  infoPanel.rotation.set(-Math.PI/2,0,0);

  infoPanel.lookAt(
    camera.position.x,
    infoPanel.position.y,
    camera.position.z
  );

  infoPanel.visible = infoVisible;

  ball.visible = true;

  reticle.visible = false;

  showToggle();
}

function placeFallback(){

  const cam = renderer.xr.getCamera(camera);

  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  cam.getWorldPosition(pos);
  cam.getWorldQuaternion(quat);

  const forward = new THREE.Vector3(0,0,-1)
    .applyQuaternion(quat)
    .multiplyScalar(.4);

  pos.add(forward);

  placeBall(pos, quat);

  log("Placed");
}

//////////////////////////////////////////////////////
// Tap placement
//////////////////////////////////////////////////////

const controller = renderer.xr.getController(0);

controller.addEventListener("select",()=>{

  if(reticle.visible && ball){

    const pos = new THREE.Vector3()
      .setFromMatrixPosition(reticle.matrix);

    placeBall(pos,new THREE.Quaternion());

    log("Placed on surface");

  }

});

scene.add(controller);

//////////////////////////////////////////////////////
// AR button
//////////////////////////////////////////////////////

document.getElementById("arContainer").appendChild(

  ARButton.createButton(renderer,{
    requiredFeatures:["local-floor"],
    optionalFeatures:["hit-test"]
  })

);

//////////////////////////////////////////////////////
// Hit test loop
//////////////////////////////////////////////////////

let hitSource=null;
let hitRequested=false;

renderer.setAnimationLoop((t,frame)=>{

  if(frame){

    const session = renderer.xr.getSession();
    const refSpace = renderer.xr.getReferenceSpace();

    if(session && !hitRequested){

      session.requestReferenceSpace("viewer").then(space=>{
        session.requestHitTestSource({space}).then(src=>{
          hitSource=src;
        });
      });

      hitRequested=true;

      setTimeout(placeFallback,700);
    }

    if(hitSource){

      const hits = frame.getHitTestResults(hitSource);

      if(hits.length){

        const pose = hits[0].getPose(refSpace);

        reticle.matrix.fromArray(pose.transform.matrix);

        if(!reticle.visible){

          reticle.visible=true;

          reticleTimer=setTimeout(()=>{
            reticle.visible=false;
          },500);

        }

      }else{

        reticle.visible=false;
        log("Scanning…");

      }
    }
  }

  renderer.render(scene,camera);

});

//////////////////////////////////////////////////////
// Resize
//////////////////////////////////////////////////////

window.addEventListener("resize",()=>{
  renderer.setSize(window.innerWidth,window.innerHeight);
});
