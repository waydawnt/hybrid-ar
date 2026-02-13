// android.js - robust WebXR enter + hit-test placement + fallback
document.addEventListener('DOMContentLoaded', () => {
  const sceneEl = document.querySelector('a-scene');
  const cameraEl = document.getElementById('camera');
  const ball = document.getElementById('ball');
  const reticle = document.getElementById('reticle');
  const hint = document.getElementById('hint');
  const placeBtn = document.getElementById('placeBtn');
  const resetBtn = document.getElementById('resetBtn');
  const fallbackBtn = document.getElementById('fallbackBtn');
  const enterBtn = document.getElementById('enterAR');
  const enterWrapper = document.getElementById('enterWrapper');

  // feature detect
  const hasXR = !!navigator.xr;
  console.log('hasXR =', hasXR);

  if (!hasXR) {
    hint.innerText = 'WebXR not available. Use Chrome on ARCore-compatible Android.';
    enterBtn.disabled = true;
    placeBtn.disabled = true;
    fallbackBtn.disabled = true;
    return;
  }

  let placed = false;
  let reticleVisible = false;
  let noReticleTimer = null;
  const NO_RETICLE_TIMEOUT = 6000;

  // helper
  function showHint(text) {
    hint.innerText = text;
    console.log('[AR HINT]', text);
  }

  // Observe reticle visibility toggles (hit-test toggles the 'visible' attr)
  const observer = new MutationObserver(() => {
    const v = reticle.getAttribute('visible');
    reticleVisible = !!v;
    if (reticleVisible) {
      showHint('Surface detected — tap to place');
      fallbackBtn.style.display = 'none';
      if (noReticleTimer) { clearTimeout(noReticleTimer); noReticleTimer = null; }
    } else {
      showHint('Scanning for surfaces — move phone slowly');
      if (!noReticleTimer) {
        noReticleTimer = setTimeout(() => {
          fallbackBtn.style.display = 'inline-block';
          showHint('No surface found — use Place Anyway or move phone slowly');
        }, NO_RETICLE_TIMEOUT);
      }
    }
  });
  observer.observe(reticle, { attributes: true, attributeFilter: ['visible'] });

  // Place at reticle pose
  function placeAtReticle() {
    if (!reticle.object3D) { showHint('Reticle not ready'); return; }
    const r = reticle.object3D;
    const b = ball.object3D;
    b.position.copy(r.position);
    b.quaternion.copy(r.quaternion);
    ball.setAttribute('visible', true);
    placed = true;
    showHint('Placed — tap to reposition or Reset');
  }

  // fallback placement 1.5m in front of camera
  function placeFallback() {
    const cam = cameraEl.object3D;
    const b = ball.object3D;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
    const pos = cam.position.clone().add(forward.multiplyScalar(1.5));
    b.position.copy(pos);
    b.quaternion.copy(cam.quaternion);
    ball.setAttribute('visible', true);
    placed = true;
    showHint('Placed (fallback). Move/reset if needed.');
  }

  // Scene click handler (tap to place if reticle visible)
  sceneEl.addEventListener('click', () => {
    if (reticleVisible) placeAtReticle();
    else showHint('No surface yet — move device or use Place Anyway');
  });

  placeBtn.addEventListener('click', () => {
    if (reticleVisible) placeAtReticle();
    else showHint('No surface detected yet — move slowly or use Place Anyway');
  });

  fallbackBtn.addEventListener('click', placeFallback);

  resetBtn.addEventListener('click', () => {
    ball.setAttribute('visible', false);
    placed = false;
    showHint('Reset — move device to find a plane and place again');
    fallbackBtn.style.display = 'none';
    if (noReticleTimer) { clearTimeout(noReticleTimer); noReticleTimer = null; }
  });

  // ENTER AR button: try A-Frame's enterVR first; fallback to explicit requestSession
  enterBtn.addEventListener('click', async () => {
    showHint('Requesting AR session...');
    try {
      // hide the enter UI while session starts
      enterWrapper.style.display = 'none';

      // A-Frame's helper should work on most devices
      if (sceneEl && typeof sceneEl.enterVR === 'function') {
        sceneEl.enterVR();
        // enter-vr event will fire when XR starts
        return;
      }

      // fallback: manual WebXR request
      const session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test', 'dom-overlay'], domOverlay: { root: document.body } });
      // attach session to three.js renderer used by A-Frame
      const renderer = sceneEl.renderer;
      await renderer.xr.setSession(session);
      showHint('AR session started (fallback path). Move phone slowly to scan surfaces.');
    } catch (err) {
      console.error('Failed to start AR session:', err);
      showHint('Could not start AR session. Check Chrome + ARCore on your device.');
      // restore enter button so user can retry
      enterWrapper.style.display = 'block';
    }
  });

  // On enter-vr (session started) show initial hint and start reticle timer
  sceneEl.addEventListener('enter-vr', () => {
    showHint('Move your phone slowly to detect flat surfaces.');
    fallbackBtn.style.display = 'none';
    if (noReticleTimer) { clearTimeout(noReticleTimer); noReticleTimer = null; }
    noReticleTimer = setTimeout(() => {
      if (!reticleVisible) {
        fallbackBtn.style.display = 'inline-block';
        showHint('No surface detected — try "Place Anyway" or move phone slowly');
      }
    }, NO_RETICLE_TIMEOUT);
  });

  // On exit-vr
  sceneEl.addEventListener('exit-vr', () => {
    if (noReticleTimer) { clearTimeout(noReticleTimer); noReticleTimer = null; }
    showHint('Session ended');
    fallbackBtn.style.display = 'none';
    // show enter UI again so user can re-open
    enterWrapper.style.display = 'block';
  });

  // small console hint so you can debug with chrome://inspect
  console.log('AR page ready. navigator.xr:', !!navigator.xr);
});
