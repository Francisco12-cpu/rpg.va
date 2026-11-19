// Painel do Mestre: vê ao vivo o que o óculos vê e manda comandos.
import { carregarPeerJS, PREFIXO } from './sala.js';

const $ = (id) => document.getElementById(id);
let peer = null, conn = null;

function selo(texto, tipo) {
  const s = $('estado');
  s.textContent = texto;
  s.className = 'selo' + (tipo ? ' ' + tipo : '');
}

async function conectar(codigo) {
  $('erro').textContent = '';
  selo('conectando…');
  try { await carregarPeerJS(); } catch (e) { $('erro').textContent = e.message; selo('erro', 'erro'); return; }
  desconectar(false);
  peer = new window.Peer({ debug: 1 });
  peer.on('open', () => {
    conn = peer.connect(PREFIXO + codigo, { reliable: true });
    const desistir = setTimeout(() => {
      if (!conn || !conn.open) { $('erro').textContent = 'Não achei o óculos com esse código. Confira se o 🧙 está aberto nele.'; selo('desconectado'); }
    }, 10000);
    conn.on('open', () => {
      clearTimeout(desistir);
      selo(`conectado · ${codigo}`, 'ok');
      $('entrar').hidden = true;
      $('painel').hidden = false;
      try { localStorage.setItem('rpg-va-ultimo-codigo', codigo); } catch (e) { /* ignore */ }
    });
    conn.on('data', receber);
    conn.on('close', () => { selo('o óculos desconectou', 'erro'); mostrarEntrada(); });
  });
  peer.on('call', (call) => {
    call.answer();
    call.on('stream', (stream) => {
      $('video').srcObject = stream;
      $('semVideo').hidden = true;
    });
  });
  peer.on('error', (e) => {
    $('erro').textContent = e.type === 'peer-unavailable'
      ? 'Não achei o óculos com esse código. Confira se o 🧙 está aberto nele.'
      : `Erro na conexão (${e.type}).`;
    selo('erro', 'erro');
  });
}

function desconectar(voltar = true) {
  if (conn) { try { conn.close(); } catch (e) { /* ignore */ } conn = null; }
  if (peer) { peer.destroy(); peer = null; }
  $('video').srcObject = null;
  $('semVideo').hidden = false;
  if (voltar) { selo('desconectado'); mostrarEntrada(); }
}

function mostrarEntrada() { $('painel').hidden = true; $('entrar').hidden = false; }

function enviar(msg) { if (conn && conn.open) conn.send(msg); }

// estado que o óculos manda a cada segundo
function receber(msg) {
  if (!msg || msg.tipo !== 'estado') return;
  const partes = [
    msg.fonte === 'camera' ? '📷 câmera' : '🖼 foto',
    msg.oculos ? '👓 no óculos' : '📱 tela normal',
    msg.grade ? `▦ grade ok (${msg.casas} casas)` : '▦ procurando a grade',
    `${msg.fps} FPS`,
  ];
  $('info').textContent = partes.join('  ·  ');
  for (const b of document.querySelectorAll('.alternar')) b.classList.toggle('ligado', !!msg.opcoes?.[b.dataset.chave]);
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const c = $('codigo').value.trim();
  if (/^\d{4}$/.test(c)) conectar(c);
});
$('formMsg').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('msg').value.trim();
  if (t) { enviar({ tipo: 'aviso', texto: t }); $('msg').value = ''; }
});
for (const b of document.querySelectorAll('.rapida')) b.addEventListener('click', () => enviar({ tipo: 'aviso', texto: b.textContent }));
for (const b of document.querySelectorAll('.alternar')) b.addEventListener('click', () => enviar({ tipo: 'alternar', chave: b.dataset.chave }));
$('btDesconectar').addEventListener('click', () => desconectar());

// ?codigo=1234 no link já conecta
const p = new URLSearchParams(location.search).get('codigo');
try { $('codigo').value = p || localStorage.getItem('rpg-va-ultimo-codigo') || ''; } catch (e) { /* ignore */ }
if (p && /^\d{4}$/.test(p)) conectar(p);
