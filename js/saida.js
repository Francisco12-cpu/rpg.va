// Mostra a imagem pronta na tela: inteira (modo normal) ou dividida em dois
// olhos com correção da curvatura da lente (modo óculos).
// A correção e os ajustes vieram do js/vr.js do projeto cacador-de-sinal.
//
// A câmera é uma só, então os dois olhos recebem a mesma imagem.
import * as THREE from 'three';

const CHAVE = 'rpg-va-oculos-v1';

export function ajustesPadrao() {
  return {
    lensOffset: 0,    // afasta (+) ou aproxima (−) o centro das imagens
    lensY: 0,         // sobe (+) ou desce (−) as imagens
    k1: 0.28,         // curvatura da lente
    k2: 0.12,
    zoom: 0.82,       // tamanho da imagem dentro da lente
    distortion: true, // corrigir curvatura
  };
}

export function carregarAjustes() {
  try {
    return { ...ajustesPadrao(), ...(JSON.parse(localStorage.getItem(CHAVE) || 'null') || {}) };
  } catch (e) { return ajustesPadrao(); }
}

export function salvarAjustes(a) {
  try { localStorage.setItem(CHAVE, JSON.stringify(a)); } catch (e) { /* modo anônimo etc. */ }
}

// Pré-distorção "barril" para compensar a lente (que distorce em almofada).
const FRAG = `
uniform sampler2D tex;
uniform vec2 center;
uniform float k1, k2, zoom, aspect, enabled;
varying vec2 vUv;
void main() {
  vec2 p = vUv - center;
  p.x *= aspect;
  float r2 = dot(p, p);
  float f = enabled > 0.5 ? (1.0 + k1 * r2 + k2 * r2 * r2) : 1.0;
  vec2 q = p * f * zoom;
  q.x /= aspect;
  vec2 uv = q + vec2(0.5);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  gl_FragColor = texture2D(tex, uv);
}`;

export class Saida {
  constructor(renderer, ajustes) {
    this.renderer = renderer;
    this.ajustes = ajustes;
    this.oculos = false;
    this.rt = new THREE.WebGLRenderTarget(16, 16, { depthBuffer: true });
    this.rt.texture.minFilter = THREE.LinearFilter;
    this.rt.texture.generateMipmaps = false;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tex: { value: this.rt.texture }, center: { value: new THREE.Vector2(0.5, 0.5) },
        k1: { value: 0 }, k2: { value: 0 }, zoom: { value: 1 }, aspect: { value: 1 }, enabled: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.cenaQuad = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.cenaQuad.add(quad);
    this.camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._tam = new THREE.Vector2();
  }

  mostrar(compositor) {
    const r = this.renderer, s = this.ajustes, u = this.mat.uniforms;
    r.getDrawingBufferSize(this._tam);
    const W = this._tam.x, H = this._tam.y, pr = r.getPixelRatio();

    if (!this.oculos) {
      if (this.rt.width !== W || this.rt.height !== H) this.rt.setSize(W, H);
      compositor.desenhar(r, this.rt, W / H, false);
      r.setRenderTarget(null);
      r.setScissorTest(false);
      r.setViewport(0, 0, W / pr, H / pr);
      r.clear();
      u.enabled.value = 0; u.zoom.value = 1; u.aspect.value = W / H; u.center.value.set(0.5, 0.5);
      r.render(this.cenaQuad, this.camQuad);
      return;
    }

    const ew = Math.floor(W / 2);
    if (this.rt.width !== ew || this.rt.height !== H) this.rt.setSize(ew, H);
    compositor.desenhar(r, this.rt, ew / H, true);
    r.setRenderTarget(null);
    r.setScissorTest(false);
    r.setViewport(0, 0, W / pr, H / pr);
    r.clear();
    u.k1.value = s.k1; u.k2.value = s.k2; u.zoom.value = s.zoom;
    u.aspect.value = ew / H; u.enabled.value = s.distortion ? 1 : 0;
    for (const [x, dir] of [[0, +1], [ew, -1]]) {
      // olho esquerdo (dir=+1) vai para a direita com lensOffset > 0
      u.center.value.set(0.5 - dir * s.lensOffset * 0.5, 0.5 - s.lensY * 0.5);
      r.setScissorTest(true);
      r.setScissor(x / pr, 0, ew / pr, H / pr);
      r.setViewport(x / pr, 0, ew / pr, H / pr);
      r.render(this.cenaQuad, this.camQuad);
    }
    r.setScissorTest(false);
  }
}
