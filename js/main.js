// RPG VA — óculos de realidade aumentada para a mesa de RPG.
import * as THREE from 'three';
import { abrirCamera, abrirFoto, mensagemDeErro } from './fonte.js';
import { Camada, desenharMolduraTeste } from './camada.js';
import { Hud } from './hud.js';
import { Compositor } from './compositor.js';
import { Saida, ajustesPadrao, carregarAjustes, salvarAjustes } from './saida.js';
import { LeitorGrade, desenharGrade } from './grade.js';
import { SalaJogador } from './sala.js';

const VERSAO = 'v0.3 · fase 2 + mestre';
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
let molduraTeste = false;
let mostrarGrade = true;
let mostrarNumeros = false;
const grade = new LeitorGrade();
let rodando = false;

// ---------------------------------------------------------------- início
async function iniciar(tipo) {
  $('erro').textContent = '';
  try {
    fonte = tipo === 'camera' ? await abrirCamera() : await abrirFoto(fotoTeste());
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
  sala.fechar();
  $('painelSala').hidden = true;
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
  grade.atualizar(fonte, agora);
  if (mostrarGrade) desenharGrade(camada, grade, { numeros: mostrarNumeros || molduraTeste, retas: molduraTeste });
  // Fases 3+ desenham aqui: caminho, linhas-armadilha, monstros...
  camada.pronto();

  const status = grade.achou ? `▦ grade ok · ${grade.casas.length} casas` : '▦ procurando a grade…';
  hud.atualizar({ status, fps: Math.round(fps) });
  saida.mostrar(compositor);
  enviarParaMestre(agora);
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
    if (saida && saida.oculos && $('ajustes').hidden && $('painelSala').hidden) $('barra').hidden = true;
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

// ---------------------------------------------------------------- Modo Mestre
// canvas pequeno com o que o jogador vê: vira o vídeo do Painel do Mestre
const canvasVideo = document.createElement('canvas');
canvasVideo.width = 640; canvasVideo.height = 360;
const ctxVideo = canvasVideo.getContext('2d');
let proximoVideo = 0, proximoEstado = 0;

const sala = new SalaJogador({
  canvasVideo,
  aoMensagem: receberDoMestre,
  aoMudar: atualizarSala,
});

function receberDoMestre(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.tipo === 'aviso' && typeof msg.texto === 'string') hud.aviso(msg.texto.slice(0, 60), 4000);
  else if (msg.tipo === 'alternar') {
    if (msg.chave === 'grade') mostrarGrade = !mostrarGrade;
    else if (msg.chave === 'numeros') mostrarNumeros = !mostrarNumeros;
    atualizarBotoes();
    proximoEstado = 0;
  }
}

function enviarParaMestre(agora) {
  if (sala.estado !== 'conectado') return;
  if (agora >= proximoVideo) {
    proximoVideo = agora + 80;
    const tela = $('tela');
    const h = Math.round(640 * tela.height / tela.width) || 360;
    if (canvasVideo.height !== h) canvasVideo.height = h;
    ctxVideo.drawImage(tela, 0, 0, canvasVideo.width, canvasVideo.height);
  }
  if (agora >= proximoEstado) {
    proximoEstado = agora + 1000;
    sala.enviar({
      tipo: 'estado', fps: Math.round(fps), fonte: fonte && fonte.tipo, oculos: !!(saida && saida.oculos),
      grade: grade.achou, casas: grade.casas.length,
      opcoes: { grade: mostrarGrade, numeros: mostrarNumeros },
    });
  }
}

function linkMestre() {
  return new URL('mestre.html?codigo=' + sala.codigo, location.href).href;
}

function atualizarSala() {
  const textos = {
    desligada: 'desligado', abrindo: 'abrindo a sala…', esperando: 'esperando o Mestre conectar…',
    conectado: '✔ Mestre conectado', erro: sala.erro,
  };
  $('salaCodigo').textContent = sala.codigo;
  $('salaEstado').textContent = textos[sala.estado] || '';
  $('salaEstado').className = sala.estado === 'conectado' ? 'ok' : sala.estado === 'erro' ? 'ruim' : '';
  $('salaLink').textContent = linkMestre();
  $('salaLink').href = linkMestre();
  $('btMestre').classList.toggle('ligado', sala.aberta);
  if (sala.estado === 'conectado') hud.aviso('🧙 Mestre conectado', 3000);
  else if (sala.estado === 'esperando') hud.aviso(`🧙 Código do Mestre: ${sala.codigo}`, 8000);
}

function abrirSala() {
  $('painelSala').hidden = false;
  if (!sala.peer) sala.abrir();
  atualizarSala();
}
$('btFecharSala').addEventListener('click', () => { $('painelSala').hidden = true; if (saida && saida.oculos) esconderBarraDepois(); });
$('btDesligarSala').addEventListener('click', () => { sala.fechar(); $('painelSala').hidden = true; });

// ---------------------------------------------------------------- botões e teclado
function atualizarBotoes() {
  $('btOculos').classList.toggle('ligado', !!(saida && saida.oculos));
  $('btTeste').classList.toggle('ligado', molduraTeste);
  $('btGrade').classList.toggle('ligado', mostrarGrade);
}
function alternarGrade() { mostrarGrade = !mostrarGrade; atualizarBotoes(); }
function alternarOculos() { if (!saida) return; if (saida.oculos) sairOculos(); else entrarOculos(); }
function alternarTeste() { molduraTeste = !molduraTeste; atualizarBotoes(); }

$('btCamera').addEventListener('click', () => iniciar('camera'));
$('btFoto').addEventListener('click', () => iniciar('foto'));
$('btOculos').addEventListener('click', alternarOculos);
$('btAjustar').addEventListener('click', abrirAjustes);
$('btTeste').addEventListener('click', alternarTeste);
$('btGrade').addEventListener('click', alternarGrade);
$('btMestre').addEventListener('click', abrirSala);
$('btSair').addEventListener('click', sair);
document.addEventListener('fullscreenchange', () => {
  // saiu da tela cheia pelo botão "voltar" do celular → sai do óculos também
  if (!document.fullscreenElement && saida && saida.oculos && $('ajustes').hidden) sairOculos();
});
// atalhos de teste: ?foto abre direto com a foto (?foto=assets/testes/2.jpg escolhe outra);
// ?oculos já entra no óculos
const params = new URLSearchParams(location.search);
function fotoTeste() { return params.get('foto') || 'assets/mesa-teste.jpg'; }
if (params.has('oculos')) $('opOculos').checked = true;
if (params.has('debug')) molduraTeste = true;
if (params.has('foto')) iniciar('foto').then(() => { if (params.has('mestre')) abrirSala(); });

window.addEventListener('keydown', (e) => {
  if (!compositor || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'o') alternarOculos();
  else if (k === 't') alternarTeste();
  else if (k === 'g') alternarGrade();
  else if (k === 'm') abrirSala();
  else if (k === 'n') { mostrarNumeros = !mostrarNumeros; }
  else if (k === 'a') { if ($('ajustes').hidden) abrirAjustes(); else $('ajustes').hidden = true; }
  else if (k === 'escape') { if (!$('ajustes').hidden) $('ajustes').hidden = true; else sair(); }
});
