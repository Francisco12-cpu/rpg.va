// Painel de informações desenhado DENTRO da imagem (aparece nos dois olhos do
// óculos, onde os botões e textos HTML não dá para ver).
import * as THREE from 'three';

export class Hud {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 200;
    this.ctx = this.canvas.getContext('2d');
    this.textura = new THREE.CanvasTexture(this.canvas);
    this.textura.minFilter = THREE.LinearFilter;
    this.textura.generateMipmaps = false;
    this.mensagem = '';
    this.mensagemAte = 0;
    this._chave = '';
  }

  get largura() { return this.canvas.width; }
  get altura() { return this.canvas.height; }

  aviso(texto, ms = 2500) {
    this.mensagem = texto;
    this.mensagemAte = performance.now() + ms;
  }

  // info: { status, fps }
  atualizar(info) {
    const agora = performance.now();
    const msg = agora < this.mensagemAte ? this.mensagem : '';
    const chave = `${info.status}|${info.fps}|${msg}`;
    if (chave === this._chave) return; // só redesenha quando muda
    this._chave = chave;

    const c = this.ctx, W = this.canvas.width;
    c.clearRect(0, 0, W, this.canvas.height);
    c.textBaseline = 'middle';

    c.font = '600 34px system-ui, sans-serif';
    const texto = `${info.status}   ·   ${info.fps} FPS`;
    const tw = c.measureText(texto).width + 56;
    c.fillStyle = 'rgba(11,17,24,.62)';
    pilula(c, (W - tw) / 2, 14, tw, 64);
    c.fill();
    c.fillStyle = '#f2f6fa';
    c.textAlign = 'center';
    c.fillText(texto, W / 2, 47);

    if (msg) {
      c.font = '700 40px system-ui, sans-serif';
      const mw = Math.min(W - 10, c.measureText(msg).width + 64);
      c.fillStyle = 'rgba(185,140,255,.92)';
      pilula(c, (W - mw) / 2, 104, mw, 76);
      c.fill();
      c.fillStyle = '#1d0f33';
      c.fillText(msg, W / 2, 143, W - 40);
    }
    this.textura.needsUpdate = true;
  }
}

function pilula(c, x, y, w, h) {
  const r = h / 2;
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
