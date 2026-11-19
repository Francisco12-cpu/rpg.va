// Junta tudo numa imagem só: câmera ao fundo, camada de desenho por cima,
// HUD e (a partir da Fase 4) os modelos 3D. Quem mostra na tela (normal ou
// óculos) é o saida.js.
//
// Os planos usam um shader "cru" (sem conversão de cor) para a imagem da
// câmera sair com as cores de verdade, igual na tela normal e no óculos.
import * as THREE from 'three';

const VERT = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform sampler2D map; uniform vec2 rep; uniform vec2 off; varying vec2 vUv;
void main() { gl_FragColor = texture2D(map, vUv * rep + off); }`;

function materialCru(textura, transparente) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: textura },
      rep: { value: new THREE.Vector2(1, 1) },
      off: { value: new THREE.Vector2(0, 0) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: !!transparente,
    depthTest: false,
    depthWrite: false,
  });
}

function plano(material, ordem) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  m.renderOrder = ordem;
  m.frustumCulled = false;
  return m;
}

export class Compositor {
  constructor(fonte, camada, hud) {
    this.fonte = fonte;
    this.hud = hud;
    this.cena = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    const tex = fonte.tipo === 'camera' ? new THREE.VideoTexture(fonte.el) : new THREE.Texture(fonte.el);
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.fundoMat = materialCru(tex, false);
    this.camadaMat = materialCru(camada.textura, true);
    this.hudMat = materialCru(hud.textura, true);
    this.hudMesh = plano(this.hudMat, 2);
    this.cena.add(plano(this.fundoMat, 0), plano(this.camadaMat, 1), this.hudMesh);

    // Fase 4: monstros 3D em cima dos dados entram aqui.
    this.cena3d = new THREE.Scene();
    this.cam3d = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    this.cena3d.add(new THREE.HemisphereLight(0xffffff, 0x334455, 2));

    // parte da imagem da câmera que aparece (o resto é cortado para encher a tela)
    this.recorte = { x: 0, y: 0, w: 1, h: 1 };
  }

  // Corta a imagem da câmera para encher a área (como object-fit: cover).
  enquadrar(aspecto, oculos) {
    const af = this.fonte.largura / this.fonte.altura;
    let rx = 1, ry = 1;
    if (af > aspecto) rx = aspecto / af; else ry = af / aspecto;
    const ox = (1 - rx) / 2, oy = (1 - ry) / 2;
    for (const m of [this.fundoMat, this.camadaMat]) {
      m.uniforms.rep.value.set(rx, ry);
      m.uniforms.off.value.set(ox, oy);
    }
    this.recorte = { x: ox, y: oy, w: rx, h: ry };

    // HUD: no óculos fica mais perto do centro (as bordas somem na lente)
    const w = oculos ? 1.15 : 0.95;
    const h = w * (this.hud.altura / this.hud.largura) * aspecto;
    this.hudMesh.scale.set(w / 2, h / 2, 1);
    this.hudMesh.position.set(0, oculos ? 0.38 : 1 - h / 2 - 0.03, 0);
  }

  desenhar(renderer, alvo, aspecto, oculos) {
    this.enquadrar(aspecto, oculos);
    renderer.setRenderTarget(alvo);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(this.cena, this.cam);
    if (this.cena3d.children.length > 1) {
      renderer.clearDepth();
      this.cam3d.aspect = aspecto;
      this.cam3d.updateProjectionMatrix();
      renderer.render(this.cena3d, this.cam3d);
    }
  }
}
