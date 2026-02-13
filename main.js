import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { ARButton } from "https://unpkg.com/three@0.160.0/examples/jsm/webxr/ARButton.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const hint = document.getElementById("hint");

function log(msg){
  console.log("[AR]", msg);
  hint.innerText = msg;
}

//////////////////////////////////////////////////////
// Scene setup
//////////////////////////////////////////////////////

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

const renderer = new THREE.WebGLRenderer({
  antialias:true,
  alpha:true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;

document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff,0xbbbbff,1));

//////////////////////////////////////////////////////
// Model
//////////////////////////////////////////////////////

let model;

new GLTFLoader().load("model.glb",(gltf)=>{

  model = gltf.scene;
  model.scale.set(.3,.3,.3);
  model.visible = false;

  scene.add(model);

  log("Model loaded");

});

//////////////////////////////////////////////////////
// Reticle
//////////////////////////////////////////////////////

let hitTestSource = null;
let hitTestRequested = false;

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(.08,.1,32).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial()
);

reticle.matrixAutoUpdate = false;
reticle.visible = false;

scene.add(reticle);

//////////////////////////////////////////////////////
// Fallback placement
//////////////////////////////////////////////////////

function placeFallback(){

  if(!model) return;

  const cam = renderer.xr.getCamera(camera);

  const dir = new THREE.Vector3(0,0,-1)
    .applyQuaternion(cam.quaternion)
    .multiplyScalar(1.5);

  model.position.copy(cam.position).add(dir);
  model.quaternion.copy(cam.quaternion);
  model.visible = true;

  log("Fallback placement");
}

//////////////////////////////////////////////////////
// Controller tap placement
//////////////////////////////////////////////////////

const controller = renderer.xr.getController(0);
scene.add(controller);

controller.addEventListener("select",()=>{

  if(reticle.visible && model){

    model.position.setFromMatrixPosition(reticle.matrix);
    model.visible = true;

    log("Placed on surface");

  }

});

//////////////////////////////////////////////////////
// REAL AR BUTTON (styled)
//////////////////////////////////////////////////////

const arButton = ARButton.createButton(renderer,{
  requiredFeatures:["local-floor"],
  optionalFeatures:["hit-test"]
});

arButton.style.position = "fixed";
arButton.style.bottom = "20px";
arButton.style.left = "50%";
arButton.style.transform = "translateX(-50%)";
arButton.style.padding = "16px 24px";
arButton.style.fontSize = "18px";
arButton.style.fontWeight = "bold";
arButton.style.borderRadius = "10px";
arButton.style.background = "#00d0c0";
arButton.style.color = "#002";
arButton.innerText = "ENTER AR";

document.body.appendChild(arButton);

//////////////////////////////////////////////////////
// XR frame loop
//////////////////////////////////////////////////////

renderer.setAnimationLoop((timestamp,frame)=>{

  if(frame){

    const refSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if(!hitTestRequested){

      session.requestReferenceSpace("viewer").then(space=>{

        session.requestHitTestSource({space}).then(source=>{
          hitTestSource = source;
        });

      });

      session.addEventListener("end",()=>{
        hitTestSource = null;
        hitTestRequested = false;
      });

      hitTestRequested = true;

      setTimeout(placeFallback,800);
    }

    if(hitTestSource){

      const hits = frame.getHitTestResults(hitTestSource);

      if(hits.length){

        const hit = hits[0];
        const pose = hit.getPose(refSpace);

        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);

        log("Surface detected — tap");

      }else{

        reticle.visible = false;
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
