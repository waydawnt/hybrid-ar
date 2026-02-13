// WebXR placement logic for android.html
document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  const ball = document.getElementById('ball');
  const reticle = document.getElementById('reticle');
  const hint = document.getElementById('hint');
  const placeBtn = document.getElementById('placeBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Basic feature detection
  if (!navigator.xr) {
    hint.innerText = 'WebXR not supported in this browser. Use Chrome on Android with ARCore support.';
    placeBtn.disabled = true;
    return;
  }

  let placed = false;

  // hit-test component exposes reticle and places entity automatically when you
  // use the built-in hit-test targeting; but we also allow manual placement
  // toggle: when user taps placeBtn or screen, we set the ball visible at reticle pose.

  // Global tap to place
  scene.addEventListener('click', () => {
    // check reticle visibility
    const visible = reticle.getAttribute('visible');
    if (!visible) return;
    placeAtReticle();
  });

  placeBtn.addEventListener('click', () => {
    if (!reticle.getAttribute('visible')) return;
    placeAtReticle();
  });

  resetBtn.addEventListener('click', () => {
    ball.setAttribute('visible', false);
    placed = false;
    hint.innerText = 'Move phone to detect surface • Tap to place';
  });

  function placeAtReticle() {
    // copy world matrix of reticle to ball
    const retThree = reticle.object3D;
    const ballThree = ball.object3D;

    // copy position and rotation
    ballThree.position.copy(retThree.position);
    ballThree.quaternion.copy(retThree.quaternion);

    ball.setAttribute('visible', true);
    placed = true;
    hint.innerText = 'Placed — tap to reposition or use Reset';
  }

  // optional: hide reticle once placed (or keep it for reposition)
  // here we keep it visible to allow repositioning.
});
