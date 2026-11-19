// Camada de desenho por cima da imagem da câmera.
// Ela tem EXATAMENTE o tamanho da imagem da câmera: quem desenha usa as
// coordenadas da própria imagem (pixel x,y da foto). Assim, quando a Fase 2
// achar a grade do tabuleiro num ponto da imagem, desenhar naquele ponto cai
// em cima da casa certa, no modo normal e no óculos.
import * as THREE from 'three';

export class Camada {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 16;
    this.canvas.height = 16;
    this.ctx = this.canvas.getContext('2d');
    this.textura = new THREE.CanvasTexture(this.canvas);
    this.textura.minFilter = THREE.LinearFilter;
    this.textura.generateMipmaps = false;
  }

  get largura() { return this.canvas.width; }
  get altura() { return this.canvas.height; }

  ajustar(largura, altura) {
    if (this.canvas.width === largura && this.canvas.height === altura) return;
    this.canvas.width = largura;
    this.canvas.height = altura;
    this.textura.dispose(); // o tamanho mudou: a GPU precisa de uma textura nova
  }

  limpar() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }

  pronto() { this.textura.needsUpdate = true; }
}

// Moldura de teste: cantos, cruz no centro e pontinhos a cada 10%.
// Se ela fica grudada nas bordas da imagem (no celular e no óculos), a
// camada está alinhada com a câmera.
export function desenharMolduraTeste(camada, t) {
  const c = camada.ctx, W = camada.largura, H = camada.altura;
  const u = Math.min(W, H) / 100;
  c.save();
  c.strokeStyle = '#b98cff';
  c.lineWidth = u * 0.8;
  c.lineCap = 'round';
  const m = u * 3, L = u * 12;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    c.beginPath();
    c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y);
    c.stroke();
  }
  c.fillStyle = 'rgba(185,140,255,.55)';
  for (let i = 1; i < 10; i++) {
    for (let j = 1; j < 10; j++) {
      c.beginPath(); c.arc(W * i / 10, H * j / 10, u * 0.45, 0, Math.PI * 2); c.fill();
    }
  }
  const pulso = 1 + 0.15 * Math.sin(t * 4);
  c.strokeStyle = '#ffd34d';
  c.lineWidth = u * 0.6;
  c.beginPath(); c.arc(W / 2, H / 2, u * 5 * pulso, 0, Math.PI * 2); c.stroke();
  c.beginPath();
  c.moveTo(W / 2 - u * 8, H / 2); c.lineTo(W / 2 + u * 8, H / 2);
  c.moveTo(W / 2, H / 2 - u * 8); c.lineTo(W / 2, H / 2 + u * 8);
  c.stroke();
  c.restore();
}
