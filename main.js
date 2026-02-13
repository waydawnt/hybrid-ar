import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

//////////////////////////////////////////////////////
// UI helper
//////////////////////////////////////////////////////

const hint = document.getElementById("hint");

function log(msg){
  console.log("[AR]", msg);
  hint.textContent = msg;
}

//////////////////////////////////////////////////////
// Scene + performance renderer
//////////////////////////////////////////////////////

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

const renderer = new THREE.WebGLRenderer({
  antialias:false,
  alpha:true,
  powerPreference:"high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;

document.body.appendChild(renderer.domElement);

//////////////////////////////////////////////////////
// Lighting (cheap + mobile friendly)
//////////////////////////////////////////////////////

scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));

//////////////////////////////////////////////////////
// Therapy ball model
//////////////////////////////////////////////////////

let ball;

new GLTFLoader().load("model.glb",(gltf)=>{

  ball = gltf.scene;

  // real-world scale (~7 cm)
  ball.scale.setScalar(0.07);

  ball.visible = false;

  // freeze transforms for performance
  ball.traverse(obj=>{
    obj.matrixAutoUpdate = false;
  });

  scene.add(ball);

  log("Model ready — enter AR");

});

//////////////////////////////////////////////////////
// Surface info panel
//////////////////////////////////////////////////////

function createTextPanel(){

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "28px sans-serif";

  const lines = [
    "Latex free: Compact & portable",
    "Blunt spikes provide better grip",
    "Eco friendly version available",
    "Suitable for sensitive skin"
  ];

  lines.forEach((line,i)=>{
    ctx.fillText(line, 40, 70 + i*90);
  });

  const texture = new THREE.CanvasTexture(canvas);

  return new THREE.Mesh(
    new THREE.PlaneGeometry(0.28,0.14),
    new THREE.MeshBasicMaterial({
      map:texture,
      transparent:true
    })
  );
}

const infoPanel = createTextPanel();
infoPanel.visible = false;
scene.add(infoPanel);

//////////////////////////////////////////////////////
// Reticle (soft flash)
//////////////////////////////////////////////////////

let reticleTimer = null;

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(.06,.08,32).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({
    color:0xffffff,
    transparent:true,
    opacity:0.35
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

  // surface anchored text
  infoPanel.position.copy(ball.position)
    .add(new THREE.Vector3(.12,0.003,-.02));

  infoPanel.rotation.set(-Math.PI/2,0,0);

  infoPanel.lookAt(
    camera.position.x,
    infoPanel.position.y,
    camera.position.z
  );

  infoPanel.visible = true;
  ball.visible = true;

  reticle.visible = false;
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
// Controller tap placement
//////////////////////////////////////////////////////

const controller = renderer.xr.getController(0);

controller.addEventListener("select",()=>{

  if(reticle.visible && ball){

    const pos = new THREE.Vector3()
      .setFromMatrixPosition(reticle.matrix);

    placeBall(pos, new THREE.Quaternion());

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
// Hit-test logic
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
