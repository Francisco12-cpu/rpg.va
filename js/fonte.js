// De onde vem a imagem da mesa: a câmera traseira do celular ou uma foto
// (modo teste no PC). As duas devolvem o mesmo formato, então o resto do app
// não precisa saber qual é.

export async function abrirCamera() {
  if (!window.isSecureContext) {
    throw new Error('A câmera só abre em HTTPS (ou em localhost). Abra pelo link do GitHub Pages ou pelo INICIAR-SERVIDOR.bat.');
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Este navegador não deixa usar a câmera. Use o Chrome.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 },
    },
  });
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth) await new Promise((ok) => video.addEventListener('loadedmetadata', ok, { once: true }));

  // foco contínuo, quando o celular deixa (a mesa fica perto da câmera)
  const track = stream.getVideoTracks()[0];
  try {
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (caps.focusMode && caps.focusMode.includes('continuous')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    }
  } catch (e) { /* nem todo celular aceita */ }

  return {
    tipo: 'camera',
    el: video,
    largura: video.videoWidth,
    altura: video.videoHeight,
    // o celular pode trocar o tamanho ao girar
    atualizarTamanho() {
      if (video.videoWidth && (video.videoWidth !== this.largura || video.videoHeight !== this.altura)) {
        this.largura = video.videoWidth;
        this.altura = video.videoHeight;
        return true;
      }
      return false;
    },
    parar() { stream.getTracks().forEach((t) => t.stop()); },
  };
}

export function abrirFoto(url) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok({
      tipo: 'foto',
      el: img,
      largura: img.naturalWidth,
      altura: img.naturalHeight,
      atualizarTamanho() { return false; },
      parar() {},
    });
    img.onerror = () => erro(new Error('Não achei a foto de teste: ' + url));
    img.src = url;
  });
}

export function mensagemDeErro(e) {
  switch (e && e.name) {
    case 'NotAllowedError': return 'Permissão da câmera negada. Toque no cadeado ao lado do endereço, libere a câmera e tente de novo.';
    case 'NotFoundError': return 'Nenhuma câmera encontrada neste aparelho.';
    case 'NotReadableError': return 'A câmera está sendo usada por outro app. Feche os outros apps e tente de novo.';
    case 'OverconstrainedError': return 'A câmera não aceitou a configuração pedida.';
    default: return (e && e.message) || String(e);
  }
}
