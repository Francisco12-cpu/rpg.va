// RPG VA — Fase 1: a câmera atravessa o óculos e uma camada é desenhada por cima.
import * as THREE from 'three';
import { abrirCamera, abrirFoto, mensagemDeErro } from './fonte.js';
import { Camada, desenharMolduraTeste } from './camada.js';
import { Hud } from './hud.js';
import { Compositor } from './compositor.js';
import { Saida, ajustesPadrao, carregarAjustes, salvarAjustes } from './saida.js';

const VERSAO = 'v0.1 · fase 1';
const $ = (id) => document.getElementById(id);
$('versao').textContent = VERSAO;

const renderer = new THREE.WebGLRenderer({ canvas: $('tela'), antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
function redimensionar() { renderer.setSize(window.innerWidth, window.innerHeight, false); }
window.addEventListener('resize', redimensionar);
redimensionar();

const camada = new Camada();
const hud = new Hud();
const ajustes = carregarAjustes();
let fonte = null, compositor = null, saida = null;
let molduraTeste = true;
let rodando = false;

// ---------------------------------------------------------------- início
async function iniciar(tipo) {
  $('erro').textContent = '';
  try {
    fonte = tipo === 'camera' ? await abrirCamera() : await abrirFoto('assets/mesa-teste.jpg');
  } catch (e) {
    $('erro').textContent = mensagemDeErro(e);
    return;
  }
  compositor = new Compositor(fonte, camada, hud);
  saida = new Saida(renderer, ajustes);
  $('inicio').hidden = true;
  $('barra').hidden = false;
  manterTelaLigada();
  if ($('opOculos').checked) await entrarOculos();
  hud.aviso(tipo === 'camera' ? 'Câmera ligada' : 'Modo teste com foto');
  atualizarBotoes();
  if (!rodando) { rodando = true; requestAnimationFrame(quadro); }
}

function sair() {
  if (saida && saida.oculos) sairOculos();
  if (fonte) fonte.parar();
  fonte = null; compositor = null;
  $('barra').hidden = true;
  $('ajustes').hidden = true;
  $('inicio').hidden = false;
}

// ---------------------------------------------------------------- laço
let ultimo = performance.now(), fps = 0;
function quadro(agora) {
  if (!compositor) { rodando = false; return; }
  requestAnimationFrame(quadro);
  const dt = Math.max(1, agora - ultimo);
  ultimo = agora;
  fps = fps ? fps * 0.92 + (1000 / dt) * 0.08 : 1000 / dt;

  fonte.atualizarTamanho();
  camada.ajustar(fonte.largura, fonte.altura);
  camada.limpar();
  if (molduraTeste) desenharMolduraTeste(camada, agora / 1000);
  // Fases 2+ desenham aqui: grade do tabuleiro, caminho, linhas-armadilha...
  camada.pronto();

  hud.atualizar({ status: fonte.tipo === 'camera' ? '📷 câmera' : '🖼 foto', fps: Math.round(fps) });
  saida.mostrar(compositor);
}

// ---------------------------------------------------------------- óculos
async function entrarOculos() {
  saida.oculos = true;
  document.body.classList.add('oculos');
  try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) { /* PC/iPhone */ }
  try { await screen.orientation.lock('landscape'); } catch (e) { /* nem todo navegador deixa */ }
  esconderBarraDepois();
  hud.aviso('Modo óculos · toque na tela para os botões', 3500);
  atualizarBotoes();
}

function sairOculos() {
  saida.oculos = false;
  document.body.classList.remove('oculos');
  try { screen.orientation.unlock(); } catch (e) { /* ignore */ }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  clearTimeout(timerBarra);
  $('barra').hidden = false;
  atualizarBotoes();
}

let timerBarra = 0;
function esconderBarraDepois() {
  clearTimeout(timerBarra);
  timerBarra = setTimeout(() => {
    if (saida && saida.oculos && $('ajustes').hidden) $('barra').hidden = true;
  }, 4000);
}
// no óculos, tocar na tela (por fora) mostra os botões por 4 s
$('tela').addEventListener('pointerdown', () => {
  if (saida && saida.oculos) { $('barra').hidden = false; esconderBarraDepois(); }
});

let wakeLock = null;
async function manterTelaLigada() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* ignore */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && compositor) { wakeLock = null; manterTelaLigada(); }
});

// ---------------------------------------------------------------- ajustes do óculos
const CONTROLES = [
  ['lensOffset', 'Distância entre as imagens', -0.5, 0.5, 0.01],
  ['lensY', 'Altura das imagens', -0.5, 0.5, 0.01],
  ['zoom', 'Tamanho da imagem', 0.5, 1.3, 0.01],
  ['k1', 'Curvatura (forte)', 0, 0.8, 0.01],
  ['k2', 'Curvatura (bordas)', 0, 0.5, 0.01],
];
function montarAjustes() {
  const box = $('controles');
  box.innerHTML = '';
  for (const [chave, nome, min, max, passo] of CONTROLES) {
    const div = document.createElement('div');
    div.className = 'controle';
    div.innerHTML = `<label><span>${nome}</span><b></b></label><input type="range" min="${min}" max="${max}" step="${passo}">`;
    const input = div.querySelector('input'), valor = div.querySelector('b');
    input.value = ajustes[chave];
    valor.textContent = Number(ajustes[chave]).toFixed(2);
    input.addEventListener('input', () => {
      ajustes[chave] = Number(input.value);
      valor.textContent = ajustes[chave].toFixed(2);
      salvarAjustes(ajustes);
    });
    box.appendChild(div);
  }
  $('opCurva').checked = ajustes.distortion;
}
$('opCurva').addEventListener('change', () => { ajustes.distortion = $('opCurva').checked; salvarAjustes(ajustes); });
$('btPadrao').addEventListener('click', () => { Object.assign(ajustes, ajustesPadrao()); salvarAjustes(ajustes); montarAjustes(); });
$('btFechar').addEventListener('click', () => { $('ajustes').hidden = true; if (saida && saida.oculos) esconderBarraDepois(); });

function abrirAjustes() {
  montarAjustes();
  $('ajustes').hidden = false;
  if (saida && !saida.oculos) entrarOculos(); // ajustar só faz sentido vendo os dois olhos
}

// ---------------------------------------------------------------- botões e teclado
function atualizarBotoes() {
  $('btOculos').classList.toggle('ligado', !!(saida && saida.oculos));
  $('btTeste').classList.toggle('ligado', molduraTeste);
}
function alternarOculos() { if (!saida) return; if (saida.oculos) sairOculos(); else entrarOculos(); }
function alternarTeste() { molduraTeste = !molduraTeste; atualizarBotoes(); }

$('btCamera').addEventListener('click', () => iniciar('camera'));
$('btFoto').addEventListener('click', () => iniciar('foto'));
$('btOculos').addEventListener('click', alternarOculos);
$('btAjustar').addEventListener('click', abrirAjustes);
$('btTeste').addEventListener('click', alternarTeste);
$('btSair').addEventListener('click', sair);
document.addEventListener('fullscreenchange', () => {
  // saiu da tela cheia pelo botão "voltar" do celular → sai do óculos também
  if (!document.fullscreenElement && saida && saida.oculos && $('ajustes').hidden) sairOculos();
});
// atalhos de teste: ?foto abre direto com a foto; ?oculos já entra no óculos
const params = new URLSearchParams(location.search);
if (params.has('oculos')) $('opOculos').checked = true;
if (params.has('foto')) iniciar('foto');

window.addEventListener('keydown', (e) => {
  if (!compositor || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'o') alternarOculos();
  else if (k === 't') alternarTeste();
  else if (k === 'a') { if ($('ajustes').hidden) abrirAjustes(); else $('ajustes').hidden = true; }
  else if (k === 'escape') { if (!$('ajustes').hidden) $('ajustes').hidden = true; else sair(); }
});
