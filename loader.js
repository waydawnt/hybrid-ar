// loader.js - hybrid launcher
const btn = document.getElementById('arBtn');

function isiOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
}

btn.onclick = () => {
  if (isiOS()) {
    // iPhone -> Quick Look (USDZ)
    // model.usdz must be present and served over HTTPS
    const a = document.createElement('a');
    a.setAttribute('rel', 'ar');
    a.href = 'model.usdz';
    // Optional image child (some iOS versions use it)
    const img = document.createElement('img');
    img.src = 'thumbnail.png';
    img.style.display = 'none';
    a.appendChild(img);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1200);
  } else {
    // Android or other -> open WebXR placement page
    window.location.href = 'android.html';
  }
};
