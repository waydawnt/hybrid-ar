const btn = document.getElementById('arBtn');

function isiOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
}

btn.onclick = () => {
  if (isiOS()) {
    // iPhone: open native Quick Look USDZ
    // model.usdz must be in same folder and served over HTTPS
    const a = document.createElement('a');
    a.setAttribute('rel', 'ar');
    a.href = 'model.usdz'; // point to hosted USDZ
    // an image child gives a preview in some cases (optional)
    const img = document.createElement('img');
    img.src = 'thumbnail.png';
    img.style.display = 'none';
    a.appendChild(img);
    document.body.appendChild(a);
    a.click();
    // cleanup anchor
    setTimeout(() => a.remove(), 1000);
  } else {
    // Android / Desktop: open WebXR page (android.html)
    window.location.href = 'android.html';
  }
};
