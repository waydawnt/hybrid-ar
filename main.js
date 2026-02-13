import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

//////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////

const hint = document.getElementById("hint");
const toggleBtn = document.getElementById("toggleInfo");
const infoPanel = document.getElementById("infoPanel");

let lastHint = "";

function setHint(text){
  if(text === lastHint) return;
  lastHint = text;
  hint.textContent = text;
}

let infoVisible = false;

toggleBtn.onclick = () => {
  infoVisible = !infoVisible;
  infoPanel.style.display = infoVisible ? "block" : "none";
};

function showToggle(){
  toggleBtn.classList.add("show");
}

//////////////////////////////////////////////////
// Scene
//////////////////////////////////////////////////

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

const renderer = new THREE.WebGLRenderer({
  alpha:true,
  antialias:false,
  powerPreference:"high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.xr.enabled = true;

document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff,0xbbbbff,1));

//////////////////////////////////////////////////
// Model
//////////////////////////////////////////////////

let ball;

new GLTFLoader().load("model.glb", gltf => {

  ball = gltf.scene;
  ball.scale.setScalar(0.07);
  ball.visible = false;

  ball.traverse(o=>o.matrixAutoUpdate=false);

  scene.add(ball);
  setHint("Move phone to detect surface");
});

//////////////////////////////////////////////////
// Tiny reticle
//////////////////////////////////////////////////

const reticle = new THREE.Mesh(
  new THREE.CircleGeometry(0.006,24),
  new THREE.MeshBasicMaterial({color:0xffffff})
);

reticle.rotation.x = -Math.PI/2;
reticle.matrixAutoUpdate=false;
reticle.visible=false;

scene.add(reticle);

//////////////////////////////////////////////////
// Placement
//////////////////////////////////////////////////

function placeBall(pos){

  if(!ball) return;

  ball.position.copy(pos);
  ball.updateMatrix();
  ball.visible=true;

  showToggle();
  setHint("Ball placed — Tap Info");

}

const controller = renderer.xr.getController(0);

controller.addEventListener("select",()=>{

  if(reticle.visible){

    const pos = new THREE.Vector3()
      .setFromMatrixPosition(reticle.matrix);

    placeBall(pos);
    reticle.visible = false;
  }

});

scene.add(controller);

//////////////////////////////////////////////////
// AR Button
//////////////////////////////////////////////////

function isiOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

const arContainer = document.getElementById("arContainer");

if(isiOS()){

  // iPhone Quick Look button
  const link = document.createElement("a");
  link.rel = "ar";
  link.href = "therapy-ball.usdz";

  const btn = document.createElement("button");
  btn.innerText = "View in AR";
  btn.style.padding = "12px 18px";
  btn.style.borderRadius = "10px";
  btn.style.border = "none";
  btn.style.fontWeight = "bold";

  link.appendChild(btn);
  arContainer.appendChild(link);

  setHint("Tap to open AR");

}else{

  // Android WebXR
  arContainer.appendChild(
    ARButton.createButton(renderer,{
      requiredFeatures:["local-floor"],
      optionalFeatures:["hit-test","dom-overlay"],
      domOverlay:{root:document.body}
    })
  );

}

//////////////////////////////////////////////////
// Hit test loop
//////////////////////////////////////////////////

let hitSource=null;
let requested=false;

renderer.setAnimationLoop((t,frame)=>{

  if(frame){

    const session = renderer.xr.getSession();
    const refSpace = renderer.xr.getReferenceSpace();

    if(session && !requested){

      session.requestReferenceSpace("viewer").then(space=>{
        session.requestHitTestSource({space}).then(src=>{
          hitSource=src;
        });
      });

      requested=true;
    }

    if(hitSource){

      const hits = frame.getHitTestResults(hitSource);

      if(hits.length){

        const pose = hits[0].getPose(refSpace);

        reticle.visible=true;
        reticle.matrix.fromArray(pose.transform.matrix);

        setHint("Tap dot to place");

      }else{

        reticle.visible=false;
        setHint("Move phone to detect surface");

      }
    }
  }

  renderer.render(scene,camera);

});

//////////////////////////////////////////////////
// Resize
//////////////////////////////////////////////////

window.addEventListener("resize",()=>{
  renderer.setSize(window.innerWidth,window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
