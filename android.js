// android.js - WebXR placement with reticle feedback + fallback placement
document.addEventListener('DOMContentLoaded', () => {
  const scene = document.querySelector('a-scene');
  const ball = document.getElementById('ball');
  const reticle = document.getElementById('reticle');
  const hint = document.getElementById('hint');
  const placeBtn = document.getElementById('placeBtn');
  const resetBtn = document.getElementById('resetBtn');
  const fallbackBtn = document.getElementById('fallbackBtn');

  // Quick feature detect
  if (!navigator.xr) {
    hint.innerText = 'WebXR not supported. Use Chrome on ARCore-compatible Android.';
    placeBtn.disabled = true;
    fallbackBtn.disabled = true;
    return;
  }

  let placed = false;
  let reticleVisible = false;
  let noReticleTimer = null;
  const NO_RETICLE_TIMEOUT = 6000; // ms

  // Update hint text helper
  function showHint(text) {
    hint.innerText = text;
  }

  // The hit-test component in the <a-camera> will toggle the reticle's visible property.
  // Watch for changes and update UI.
  const observer = new MutationObserver(() => {
    const visible = reticle.getAttribute('visible');
    if (visible) {
      reticleVisible = true;
      showHint('Surface detected — tap to place');
      // hide fallback if visible
      fallbackBtn.style.display = 'none';
      if (noReticleTimer) {
        clearTimeout(noReticleTimer);
        noReticleTimer = null;
      }
    } else {
      reticleVisible = false;
      showHint('Scanning for surfaces — move your phone slowly');
      // if no reticle for a while, show fallback button
      if (!noReticleTimer) {
        noReticleTimer = setTimeout(() => {
          fallbackBtn.style.display = 'inline-block';
          showHint('No surface detected — try "Place Anyway" or move phone slowly');
        }, NO_RETICLE_TIMEOUT);
      }
    }
  });

  // Observe 'visible' attribute on reticle
  observer.observe(reticle, { attributes: true, attributeFilter: ['visible'] });

  // Place object at reticle pose
  function placeAtReticle() {
    const retThree = reticle.object3D;
    const ballThree = ball.object3D;

    if (!retThree || !retThree.position) {
      showHint('Reticle not ready');
      return;
    }

    ballThree.position.copy(retThree.position);
    ballThree.quaternion.copy(retThree.quaternion);

    ball.setAttribute('visible', true);
    placed = true;
    showHint('Placed — tap to reposition or Reset');
  }

  // Fallback: place object 1.5m in front of camera
  function placeFallback() {
    const cam = document.getElementById('camera').object3D;
    const ballThree = ball.object3D;

    // compute forward vector (z axis)
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(cam.quaternion);
    forward.normalize();

    const position = cam.position.clone().add(forward.multiplyScalar(1.5));
    ballThree.position.copy(position);
    ballThree.quaternion.copy(cam.quaternion);

    ball.setAttribute('visible', true);
    placed = true;
    showHint('Placed at a default distance (fallback). Move and Reset if needed.');
  }

  // Scene click / tap handler (tap to place if reticle visible)
  scene.addEventListener('click', (ev) => {
    if (reticleVisible) {
      placeAtReticle();
    } else {
      // no reticle - ignore tap (user can use fallback button)
      showHint('No surface yet — move device or use "Place Anyway"');
    }
  });

  placeBtn.addEventListener('click', () => {
    if (reticleVisible) {
      placeAtReticle();
    } else {
      showHint('No surface detected yet — move slowly to scan or use Place Anyway');
    }
  });

  fallbackBtn.addEventListener('click', () => {
    placeFallback();
  });

  resetBtn.addEventListener('click', () => {
    ball.setAttribute('visible', false);
    placed = false;
    showHint('Reset — move device to find a plane and place again');
    // re-run reticle timer
    if (noReticleTimer) {
      clearTimeout(noReticleTimer);
      noReticleTimer = null;
    }
    fallbackBtn.style.display = 'none';
  });

  // Small initial hint after AR session begins
  scene.addEventListener('enter-vr', () => {
    showHint('Move your phone slowly left/right to detect flat surfaces');
    // ensure fallback button hidden initially
    fallbackBtn.style.display = 'none';
    if (noReticleTimer) {
      clearTimeout(noReticleTimer);
      noReticleTimer = null;
    }
    noReticleTimer = setTimeout(() => {
      if (!reticleVisible) {
        fallbackBtn.style.display = 'inline-block';
        showHint('No surface detected — try "Place Anyway" or move phone slowly');
      }
    }, NO_RETICLE_TIMEOUT);
  });

  // Clean-up on exit
  scene.addEventListener('exit-vr', () => {
    if (noReticleTimer) {
      clearTimeout(noReticleTimer);
      noReticleTimer = null;
    }
    showHint('Session ended');
    fallbackBtn.style.display = 'none';
  });

  // Final note: reticle object is managed by hit-test component; ensure three.js is available
});
