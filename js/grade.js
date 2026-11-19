// Fase 2: acha a grade do tabuleiro na imagem da câmera, sem QR Code.
//
// 1. Diminui a imagem e marca os pixels de "linha": mais escuros que a
//    vizinhança, num lugar claro (o tabuleiro é branco, a mesa de madeira não).
// 2. Transformada de Hough: acha as retas compridas.
// 3. Separa as retas em duas famílias (as linhas "de pé" e as "deitadas").
// 4. Testa quadradinhos formados por 2 retas vizinhas de cada família, monta a
//    homografia (casa → pixel) e vê qual explica mais retas. Refina com todas.
// 5. Acompanha de um quadro para o outro, para a casa (0,0) continuar sendo a
//    mesma casa do tabuleiro enquanto a cabeça se mexe.
import { aplicar, inverter, multiplicar, homografia } from './matriz.js';

const LARG = 560;          // largura da imagem analisada
const RAIO = 6;            // vizinhança para a média local
const CLARO = 110;         // média local mínima para ser tabuleiro
const CONTRASTE = 14;      // quanto mais escuro que a vizinhança para ser linha
const NT = 180;            // ângulos testados (1 grau cada)
const MAX_RETAS = 60;
const TOL_PX = 2.6;        // distância máxima entre reta prevista e achada
const SEGURA_MS = 600;     // segura a grade por esse tempo se ela sumir

const COS = new Float32Array(NT), SIN = new Float32Array(NT);
for (let t = 0; t < NT; t++) { COS[t] = Math.cos(t * Math.PI / NT); SIN[t] = Math.sin(t * Math.PI / NT); }

// as 8 formas de girar/espelhar a grade (para manter a numeração das casas)
const SIMETRIAS = [
  [1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0],
  [-1, 0, 0, 1], [1, 0, 0, -1], [0, 1, 1, 0], [0, -1, -1, 0],
];

export class LeitorGrade {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.H = null;          // casa (u,v) → pixel da imagem PEQUENA
    this.escala = 1;        // imagem pequena → imagem da câmera
    this.casas = [];        // casas em cima do tabuleiro: [{u, v}]
    this.retas = 0;
    this.custo = 0;
    this.proxima = 0;
    this.vistoEm = 0;
    this.reancorou = false;
  }

  get achou() { return !!this.H; }

  // casa (u,v) → pixel na imagem da câmera
  paraImagem(u, v) {
    const [x, y] = aplicar(this.H, u, v);
    return [x * this.escala, y * this.escala];
  }

  // pixel da imagem da câmera → casa (u,v) com fração
  paraGrade(x, y) {
    const Hi = inverter(this.H);
    return Hi ? aplicar(Hi, x / this.escala, y / this.escala) : null;
  }

  atualizar(fonte, agora) {
    if (agora < this.proxima) return false;
    const t0 = performance.now();
    const ok = this._analisar(fonte);
    if (ok) this.vistoEm = agora;
    else if (this.H && agora - this.vistoEm > SEGURA_MS) { this.H = null; this.casas = []; }
    this.custo = this.custo * 0.8 + (performance.now() - t0) * 0.2;
    this.proxima = agora + Math.max(30, this.custo * 2);
    return true;
  }

  _analisar(fonte) {
    const w = LARG, h = Math.round(LARG * fonte.altura / fonte.largura);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.w = w; this.h = h;
    this.escala = fonte.largura / w;
    this.ctx.drawImage(fonte.el, 0, 0, w, h);
    const px = this.ctx.getImageData(0, 0, w, h).data;

    // luminância + média local (imagem integral)
    const L = new Float32Array(w * h);
    for (let i = 0, j = 0; i < L.length; i++, j += 4) L[i] = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2];
    const W1 = w + 1;
    const I = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) {
      let linha = 0;
      for (let x = 0; x < w; x++) {
        linha += L[y * w + x];
        I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + linha;
      }
    }
    const media = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - RAIO), y1 = Math.min(h, y + RAIO + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - RAIO), x1 = Math.min(w, x + RAIO + 1);
        const s = I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
        media[y * w + x] = s / ((x1 - x0) * (y1 - y0));
      }
    }
    this.media = media;

    // saturação (madeira e cadeiras são coloridas; o tabuleiro é branco/cinza)
    const sat = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < sat.length; i++, j += 4) {
      sat[i] = Math.max(px[j], px[j + 1], px[j + 2]) - Math.min(px[j], px[j + 1], px[j + 2]);
    }
    this.sat = sat;

    // pixels de linha (+ máscara engordada 1 px para conferir as bordas das casas)
    const mask = new Uint8Array(w * h);
    let nLinha = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, m = media[i];
        if (m > CLARO && m - L[i] > CONTRASTE) {
          nLinha++;
          mask[i - w - 1] = mask[i - w] = mask[i - w + 1] = mask[i - 1] = mask[i] = mask[i + 1] = mask[i + w - 1] = mask[i + w] = mask[i + w + 1] = 1;
        }
      }
    }
    this.mask = mask;
    if (nLinha < 80) return false;

    // Hough guiada pela borda: cada pixel na beirada de uma linha só vota em
    // retas na direção da própria borda (isso mata as retas "fantasma" que
    // atravessam a grade na diagonal).
    const D = Math.ceil(Math.hypot(w, h)), NR = 2 * D + 1;
    const acc = new Uint16Array(NT * NR);
    const passo = 1;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        const gx = (L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1]) - (L[i - w - 1] + 2 * L[i - 1] + L[i + w - 1]);
        const gy = (L[i + w - 1] + 2 * L[i + w] + L[i + w + 1]) - (L[i - w - 1] + 2 * L[i - w] + L[i - w + 1]);
        if (gx * gx + gy * gy < 40 * 40) continue;
        let th = Math.atan2(gy, gx);
        if (th < 0) th += Math.PI;
        const t0 = Math.round(th / Math.PI * NT);
        for (let dt = -3; dt <= 3; dt++) {
          const t = (t0 + dt + NT) % NT;
          acc[t * NR + Math.round(x * COS[t] + y * SIN[t]) + D]++;
        }
      }
    }
    const minVotos = Math.max(16, Math.round(Math.min(w, h) * 0.12));
    const picos = [];
    for (let t = 0; t < NT; t++) {
      for (let r = 1; r < NR - 1; r++) {
        const v = acc[t * NR + r];
        if (v < minVotos) continue;
        let max = true;
        for (let dt = -1; dt <= 1 && max; dt++) {
          const tt = (t + dt + NT) % NT;
          for (let dr = -1; dr <= 1; dr++) {
            if ((dt || dr) && acc[tt * NR + r + dr] > v) { max = false; break; }
          }
        }
        if (max) picos.push({ t, r: r - D, v });
      }
    }
    picos.sort((a, b) => b.v - a.v);
    // junta retas repetidas: duas retas são a mesma se, dentro da imagem,
    // ficam a menos de 3 px uma da outra nas duas pontas
    const retas = [];
    for (const p of picos) {
      if (retas.length >= MAX_RETAS) break;
      const a = COS[p.t], b = SIN[p.t], c = -p.r;
      const pontas = recortar(a, b, c, w, h);
      if (!pontas) continue;
      let repetida = false;
      for (const q of retas) {
        if (pontas.every(([x, y]) => Math.abs(q.a * x + q.b * y + q.c) < 3)) { repetida = true; break; }
        // quase paralelas que se cruzam dentro da imagem = a mesma linha
        let dt = Math.abs(p.t - q.t); if (dt > NT / 2) dt = NT - dt;
        if (dt < 4) {
          const x = cruzar({ a, b, c }, q);
          if (!x || (x[0] > 0 && x[0] < w && x[1] > 0 && x[1] < h)) { repetida = true; break; }
        }
      }
      if (!repetida) retas.push({ t: p.t, v: p.v, a, b, c });
    }
    this.retas = retas.length;
    if (retas.length < 6) return false;
    const R = retas;
    this.retasVistas = R;

    // duas famílias pelo ângulo dobrado
    const ang = (l) => [Math.cos(2 * l.t * Math.PI / NT), Math.sin(2 * l.t * Math.PI / NT)];
    let c1 = ang(R[0]), c2 = null, menor = 2;
    for (const l of R) { const g = ang(l), d = g[0] * c1[0] + g[1] * c1[1]; if (d < menor) { menor = d; c2 = g; } }
    let A = [], B = [];
    for (let it = 0; it < 6; it++) {
      A = []; B = [];
      for (const l of R) {
        const g = ang(l);
        (g[0] * c1[0] + g[1] * c1[1] >= g[0] * c2[0] + g[1] * c2[1] ? A : B).push(l);
      }
      const centro = (F) => { let x = 0, y = 0; for (const l of F) { const g = ang(l); x += g[0] * l.v; y += g[1] * l.v; } const n = Math.hypot(x, y) || 1; return [x / n, y / n]; };
      if (!A.length || !B.length) return false;
      c1 = centro(A); c2 = centro(B);
    }
    if (A.length < 3 || B.length < 3) return false;
    ordenar(A, B[0]); ordenar(B, A[0]);

    // testa quadradinhos de retas vizinhas
    const areaMin = 20, areaMax = w * h / 6;
    let melhor = null;
    for (let k = 0; k < A.length - 1; k++) {
      for (let m = 0; m < B.length - 1; m++) {
        const p00 = cruzar(A[k], B[m]), p10 = cruzar(A[k + 1], B[m]);
        const p01 = cruzar(A[k], B[m + 1]), p11 = cruzar(A[k + 1], B[m + 1]);
        if (!p00 || !p10 || !p01 || !p11) continue;
        const area = Math.abs((p10[0] - p00[0]) * (p01[1] - p00[1]) - (p10[1] - p00[1]) * (p01[0] - p00[0]));
        if (area < areaMin || area > areaMax) continue;
        const Hc = homografia([[[0, 0], p00], [[1, 0], p10], [[0, 1], p01], [[1, 1], p11]]);
        if (!Hc) continue;
        const r = pontuar(Hc, A, B, w, h);
        if (r && (!melhor || r.pontos > melhor.pontos)) melhor = r;
      }
    }
    if (!melhor || melhor.casadasA.length < 3 || melhor.casadasB.length < 3) return false;

    // refina com todos os cruzamentos das retas que bateram
    const pares = [];
    for (const [la, i] of melhor.casadasA) {
      for (const [lb, j] of melhor.casadasB) {
        const p = cruzar(la, lb);
        if (p && p[0] > -w * 0.25 && p[0] < w * 1.25 && p[1] > -h * 0.25 && p[1] < h * 1.25) pares.push([[i, j], p]);
      }
    }
    let Hn = homografia(pares) || melhor.H;
    if (!Hn) return false;

    Hn = this._manterNumeracao(Hn);
    this.H = Hn;
    this.casas = this._casasNoTabuleiro();
    return this.casas.length >= 4;
  }

  // Escolhe giro/espelho + deslocamento para a numeração das casas não pular.
  _manterNumeracao(Hn) {
    const Hi = inverter(Hn);
    if (!Hi) return Hn;
    const ant = this.H && this.casas.length ? this.casas : null;
    if (ant) {
      let melhor = null;
      const amostra = ant.length > 40 ? ant.filter((_, i) => i % Math.ceil(ant.length / 40) === 0) : ant;
      for (const [a, b, c, d] of SIMETRIAS) {
        const desl = [];
        for (const { u, v } of amostra) {
          const [px, py] = aplicar(this.H, u + 0.5, v + 0.5);
          const [gu, gv] = aplicar(Hi, px, py);
          desl.push([gu - (a * (u + 0.5) + b * (v + 0.5)), gv - (c * (u + 0.5) + d * (v + 0.5))]);
        }
        const du = Math.round(mediana(desl.map((q) => q[0]))), dv = Math.round(mediana(desl.map((q) => q[1])));
        const T = [a, b, du, c, d, dv, 0, 0, 1];
        const Ht = multiplicar(Hn, T);
        let erro = 0;
        for (const { u, v } of amostra) {
          const p = aplicar(this.H, u + 0.5, v + 0.5), q = aplicar(Ht, u + 0.5, v + 0.5);
          erro += Math.hypot(p[0] - q[0], p[1] - q[1]);
        }
        erro /= amostra.length;
        if (!melhor || erro < melhor.erro) melhor = { erro, Ht };
      }
      const [p0] = [aplicar(melhor.Ht, 0, 0)], p1 = aplicar(melhor.Ht, 1, 1);
      const tamCasa = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 10;
      this.reancorou = melhor.erro > tamCasa * 0.45;
      return melhor.Ht;
    }
    // primeira vez: u para a direita, v para baixo, casa (0,0) no centro da imagem
    this.reancorou = true;
    let escolhida = Hn, nota = -Infinity;
    for (const [a, b, c, d] of SIMETRIAS) {
      const Ht = multiplicar(Hn, [a, b, 0, c, d, 0, 0, 0, 1]);
      const o = aplicar(Ht, 0, 0), pu = aplicar(Ht, 1, 0), pv = aplicar(Ht, 0, 1);
      const ux = pu[0] - o[0], uy = pu[1] - o[1], vx = pv[0] - o[0], vy = pv[1] - o[1];
      const n = ux / (Math.hypot(ux, uy) || 1) + vy / (Math.hypot(vx, vy) || 1);
      if (n > nota) { nota = n; escolhida = Ht; }
    }
    const Hi2 = inverter(escolhida);
    const [cu, cv] = aplicar(Hi2, this.w / 2, this.h / 2);
    return multiplicar(escolhida, [1, 0, Math.floor(cu), 0, 1, Math.floor(cv), 0, 0, 1]);
  }

  // casas cujo centro cai em cima do tabuleiro (claro) e dentro da imagem
  _casasNoTabuleiro() {
    const Hi = inverter(this.H);
    if (!Hi) return [];
    const [cu, cv] = aplicar(Hi, this.w / 2, this.h / 2);
    const casas = [];
    const w = this.w, h = this.h;
    for (let v = Math.floor(cv) - 25; v <= Math.floor(cv) + 25; v++) {
      for (let u = Math.floor(cu) - 25; u <= Math.floor(cu) + 25; u++) {
        const [x, y] = aplicar(this.H, u + 0.5, v + 0.5);
        if (!(x >= 2 && y >= 2 && x < w - 2 && y < h - 2)) continue;
        if (!casaBoa(this.H, u, v, w, h)) continue;
        const k = Math.floor(y) * w + Math.floor(x);
        if (this.media[k] > CLARO + 15 && this.sat[k] < 45 && this._bordaTemLinha(u, v)) casas.push({ u, v });
      }
    }
    return casas;
  }
}

// as bordas previstas da casa caem em cima de linha escura de verdade?
LeitorGrade.prototype._bordaTemLinha = function (u, v) {
  const w = this.w, h = this.h;
  let total = 0, achou = 0;
  const lados = [[u, v, u + 1, v], [u + 1, v, u + 1, v + 1], [u, v + 1, u + 1, v + 1], [u, v, u, v + 1]];
  for (const [u0, v0, u1, v1] of lados) {
    for (let k = 1; k <= 5; k++) {
      const f = k / 6;
      const [x, y] = aplicar(this.H, u0 + (u1 - u0) * f, v0 + (v1 - v0) * f);
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue;
      total++;
      if (this.mask[yi * w + xi]) achou++;
    }
  }
  return total >= 10 && achou / total >= 0.45;
};

// casa com formato aceitável: não atravessa o horizonte, não é minúscula
// nem gigante, e os lados opostos têm tamanho parecido
function casaBoa(H, u, v, w, h) {
  const den = (x, y) => H[6] * x + H[7] * y + H[8];
  const s0 = Math.sign(den(u + 0.5, v + 0.5));
  for (const [x, y] of [[u, v], [u + 1, v], [u + 1, v + 1], [u, v + 1]]) if (Math.sign(den(x, y)) !== s0) return false;
  const p = [aplicar(H, u, v), aplicar(H, u + 1, v), aplicar(H, u + 1, v + 1), aplicar(H, u, v + 1)];
  const lado = (i, j) => Math.hypot(p[j][0] - p[i][0], p[j][1] - p[i][1]);
  const l0 = lado(0, 1), l1 = lado(1, 2), l2 = lado(2, 3), l3 = lado(3, 0);
  const menor = Math.min(l0, l1, l2, l3), maior = Math.max(l0, l1, l2, l3);
  if (menor < 4 || maior > Math.max(w, h) / 3) return false;
  if (Math.max(l0, l2) / Math.min(l0, l2) > 1.8 || Math.max(l1, l3) / Math.min(l1, l3) > 1.8) return false;
  return maior / menor < 7;
}

// pontas da reta a·x + b·y + c = 0 dentro do retângulo da imagem
function recortar(a, b, c, w, h) {
  const pts = [];
  if (Math.abs(b) > 1e-6) {
    for (const x of [0, w - 1]) { const y = -(a * x + c) / b; if (y >= 0 && y <= h - 1) pts.push([x, y]); }
  }
  if (Math.abs(a) > 1e-6) {
    for (const y of [0, h - 1]) { const x = -(b * y + c) / a; if (x >= 0 && x <= w - 1) pts.push([x, y]); }
  }
  if (pts.length < 2) return null;
  return [pts[0], pts[pts.length - 1]];
}

function cruzar(l1, l2) {
  const x = l1.b * l2.c - l1.c * l2.b, y = l1.c * l2.a - l1.a * l2.c, z = l1.a * l2.b - l1.b * l2.a;
  if (Math.abs(z) < 1e-9) return null;
  return [x / z, y / z];
}

// ordena as retas de uma família pela posição onde cruzam uma reta da outra
function ordenar(F, ref) {
  const dx = -ref.b, dy = ref.a;
  for (const l of F) { const p = cruzar(l, ref); l.pos = p ? p[0] * dx + p[1] * dy : 0; }
  F.sort((p, q) => p.pos - q.pos);
}

// quantas retas achadas a grade prevista explica
function pontuar(H, A, B, w, h) {
  const Hi = inverter(H);
  if (!Hi) return null;
  const cx = w / 2, cy = h / 2;
  const casar = (F, coord) => {
    const casadas = [], usados = new Set();
    let pontos = 0;
    for (const l of F) {
      const d0 = l.a * cx + l.b * cy + l.c;
      const px = cx - d0 * l.a, py = cy - d0 * l.b;           // ponto da reta mais perto do centro
      const pts = [[px - 40 * l.b, py + 40 * l.a], [px + 40 * l.b, py - 40 * l.a]];
      const g = pts.map(([x, y]) => aplicar(Hi, x, y)[coord]);
      if (!isFinite(g[0]) || !isFinite(g[1])) continue;
      const i = Math.round((g[0] + g[1]) / 2);
      if (Math.abs(i) > 60 || usados.has(i)) continue;
      // reta prevista "coord = i" passa perto dos dois pontos?
      let ok = true;
      for (const [x, y] of pts) {
        const q = aplicar(Hi, x, y);
        const alvo = coord === 0 ? aplicar(H, i, q[1]) : aplicar(H, q[0], i);
        if (Math.hypot(alvo[0] - x, alvo[1] - y) > TOL_PX * 2) { ok = false; break; }
      }
      if (!ok) continue;
      usados.add(i);
      casadas.push([l, i]);
      pontos += l.v;
    }
    return { casadas, pontos };
  };
  const ra = casar(A, 0), rb = casar(B, 1);
  // Penalidade: uma grade "fina demais" (metade da casa) também explica as
  // retas reais, mas prevê retas no meio das casas que não existem.
  const penal = (r) => {
    if (r.casadas.length < 2) return 0;
    const idx = r.casadas.map((q) => q[1]);
    const buracos = Math.max(...idx) - Math.min(...idx) + 1 - idx.length;
    return buracos * (r.pontos / r.casadas.length) * 1.2;
  };
  const pontos = ra.pontos - penal(ra) + rb.pontos - penal(rb);
  return { H, pontos, casadasA: ra.casadas, casadasB: rb.casadas };
}

function mediana(v) {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Desenha as casas achadas na camada (modo de conferência da Fase 2).
export function desenharGrade(camada, grade, { numeros = false, retas = false } = {}) {
  if (!grade.achou) return;
  const c = camada.ctx;
  const u0 = Math.min(camada.largura, camada.altura) / 100;
  c.save();
  c.lineWidth = u0 * 0.35;
  c.strokeStyle = 'rgba(0,229,255,.85)';
  c.fillStyle = 'rgba(0,229,255,.10)';
  for (const { u, v } of grade.casas) {
    const p = [grade.paraImagem(u, v), grade.paraImagem(u + 1, v), grade.paraImagem(u + 1, v + 1), grade.paraImagem(u, v + 1)];
    c.beginPath();
    c.moveTo(p[0][0], p[0][1]);
    for (let k = 1; k < 4; k++) c.lineTo(p[k][0], p[k][1]);
    c.closePath();
    if (u === 0 && v === 0) { c.save(); c.fillStyle = 'rgba(255,211,77,.55)'; c.fill(); c.restore(); }
    else c.fill();
    c.stroke();
  }
  if (retas && grade.retasVistas) {
    // retas que o detector achou (conferência)
    const s = grade.escala, W = grade.w, Hh = grade.h;
    c.strokeStyle = 'rgba(255,60,120,.8)';
    c.lineWidth = u0 * 0.25;
    for (const l of grade.retasVistas) {
      c.beginPath();
      if (Math.abs(l.b) > Math.abs(l.a)) {
        c.moveTo(0, (-l.c) / l.b * s); c.lineTo(W * s, (-l.c - l.a * W) / l.b * s);
      } else {
        c.moveTo((-l.c) / l.a * s, 0); c.lineTo((-l.c - l.b * Hh) / l.a * s, Hh * s);
      }
      c.stroke();
    }
  }
  if (numeros) {
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const { u, v } of grade.casas) {
      const a = grade.paraImagem(u, v), b = grade.paraImagem(u + 1, v + 1);
      const tam = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (tam < u0 * 6) continue;
      const [x, y] = grade.paraImagem(u + 0.5, v + 0.5);
      c.font = `600 ${Math.min(40, Math.round(tam * 0.22))}px system-ui, sans-serif`;
      c.fillText(`${u},${v}`, x, y);
    }
  }
  c.restore();
}
