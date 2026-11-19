// Contas de matriz 3x3 (homografia): leva um ponto da grade do tabuleiro
// (casa u,v) para um pixel da imagem, mesmo com a mesa vista inclinada.
// Matrizes em vetor de 9 números, linha por linha.

export function aplicar(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

export function multiplicar(A, B) {
  const C = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    }
  }
  return C;
}

export function inverter(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [
    A * k, -(b * i - c * h) * k, (b * f - c * e) * k,
    B * k, (a * i - c * g) * k, -(a * f - c * d) * k,
    C * k, -(a * h - b * g) * k, (a * e - b * d) * k,
  ];
}

// Resolve sistema linear (eliminação de Gauss com pivô). Muda A e b.
function resolver(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

// Homografia por mínimos quadrados: pares [[gx, gy], [ix, iy]] (grade → imagem).
// Com 4 pares é exata. Os pontos da imagem são normalizados para a conta ficar estável.
export function homografia(pares) {
  if (pares.length < 4) return null;
  let mx = 0, my = 0;
  for (const [, [x, y]] of pares) { mx += x; my += y; }
  mx /= pares.length; my /= pares.length;
  let s = 0;
  for (const [, [x, y]] of pares) s += Math.hypot(x - mx, y - my);
  s = (s / pares.length) || 1;
  let gmx = 0, gmy = 0;
  for (const [[x, y]] of pares) { gmx += x; gmy += y; }
  gmx /= pares.length; gmy /= pares.length;
  let gs = 0;
  for (const [[x, y]] of pares) gs += Math.hypot(x - gmx, y - gmy);
  gs = (gs / pares.length) || 1;

  const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const Atb = new Array(8).fill(0);
  const soma = (row, val) => {
    for (let i = 0; i < 8; i++) {
      Atb[i] += row[i] * val;
      for (let j = 0; j < 8; j++) AtA[i][j] += row[i] * row[j];
    }
  };
  for (const [[gx0, gy0], [ix0, iy0]] of pares) {
    const x = (gx0 - gmx) / gs, y = (gy0 - gmy) / gs;
    const X = (ix0 - mx) / s, Y = (iy0 - my) / s;
    soma([x, y, 1, 0, 0, 0, -x * X, -y * X], X);
    soma([0, 0, 0, x, y, 1, -x * Y, -y * Y], Y);
  }
  const h = resolver(AtA, Atb);
  if (!h) return null;
  const Hn = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  // desfaz as normalizações: H = Timg⁻¹ · Hn · Tgrade
  const Ti = [s, 0, mx, 0, s, my, 0, 0, 1];
  const Tg = [1 / gs, 0, -gmx / gs, 0, 1 / gs, -gmy / gs, 0, 0, 1];
  return multiplicar(multiplicar(Ti, Hn), Tg);
}
