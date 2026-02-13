document.addEventListener("DOMContentLoaded", () => {

const scene = document.getElementById("scene");
const camera = document.getElementById("camera");
const ball = document.getElementById("ball");
const reticle = document.getElementById("reticle");

const enterBtn = document.getElementById("enterAR");
const enterWrapper = document.getElementById("enterWrapper");

const hint = document.getElementById("hint");
const placeBtn = document.getElementById("placeBtn");
const fallbackBtn = document.getElementById("fallbackBtn");
const resetBtn = document.getElementById("resetBtn");

let reticleVisible = false;
let timeout = null;

const NO_SURFACE_TIMEOUT = 6000;

function log(msg){
  console.log("[AR]", msg);
  hint.innerText = msg;
}

if(!navigator.xr){
  log("WebXR not supported — use Chrome + ARCore");
  enterBtn.disabled = true;
  return;
}

log("Ready — tap ENTER AR");

//////////////////////////////////////////////////////
// RETICLE OBSERVER
//////////////////////////////////////////////////////

new MutationObserver(()=>{
  reticleVisible = reticle.getAttribute("visible");

  if(reticleVisible){
    log("Surface detected — tap Place");
    fallbackBtn.style.display="none";
    clearTimeout(timeout);
  }else{
    log("Scanning surfaces — move slowly");

    if(!timeout){
      timeout=setTimeout(()=>{
        fallbackBtn.style.display="inline-block";
        log("No surface — use Place Anyway");
      },NO_SURFACE_TIMEOUT);
    }
  }
}).observe(reticle,{attributes:true});

//////////////////////////////////////////////////////
// PLACEMENT
//////////////////////////////////////////////////////

function placeAtReticle(){
  if(!reticle.object3D) return;

  ball.object3D.position.copy(reticle.object3D.position);
  ball.object3D.quaternion.copy(reticle.object3D.quaternion);

  ball.setAttribute("visible",true);
  log("Placed");
}

function placeFallback(){

  const cam=camera.object3D;

  const forward=new THREE.Vector3(0,0,-1)
    .applyQuaternion(cam.quaternion)
    .multiplyScalar(1.5);

  const pos=cam.position.clone().add(forward);

  ball.object3D.position.copy(pos);
  ball.object3D.quaternion.copy(cam.quaternion);

  ball.setAttribute("visible",true);

  log("Placed (fallback)");
}

placeBtn.onclick=()=>{
  if(reticleVisible) placeAtReticle();
  else log("No surface yet");
};

fallbackBtn.onclick=placeFallback;

scene.addEventListener("click",()=>{
  if(reticleVisible) placeAtReticle();
});

resetBtn.onclick=()=>{
  ball.setAttribute("visible",false);
  fallbackBtn.style.display="none";
  log("Reset — scan again");
};

//////////////////////////////////////////////////////
// ENTER AR
//////////////////////////////////////////////////////

enterBtn.onclick=async()=>{

  log("Starting AR…");
  enterWrapper.style.display="none";

  try{

    await scene.enterVR();

  }catch(e){

    console.error(e);

    log("AR failed — check Chrome + ARCore");
    enterWrapper.style.display="block";

  }
};

//////////////////////////////////////////////////////
// SESSION EVENTS
//////////////////////////////////////////////////////

scene.addEventListener("enter-vr",()=>{
  log("Move phone slowly to scan surfaces");
});

scene.addEventListener("exit-vr",()=>{
  log("Session ended");
  enterWrapper.style.display="block";
  ball.setAttribute("visible",false);
});

});
