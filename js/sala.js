// Conexão óculos ⇄ Painel do Mestre, direto entre os aparelhos (WebRTC).
// Funciona no GitHub Pages: o PeerJS usa um servidor público só para os dois
// se acharem pelo código; a imagem vai direto de um aparelho para o outro.
// Os dois precisam de internet (de preferência no mesmo Wi-Fi).

const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
export const PREFIXO = 'rpgva-mesa-';
const CHAVE_CODIGO = 'rpg-va-codigo';

let carregando = null;
export function carregarPeerJS() {
  if (window.Peer) return Promise.resolve();
  if (!carregando) {
    carregando = new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = PEERJS;
      s.onload = () => ok();
      s.onerror = () => { carregando = null; erro(new Error('Sem internet: não deu para carregar a conexão do Mestre.')); };
      document.head.appendChild(s);
    });
  }
  return carregando;
}

function novoCodigo() { return String(Math.floor(1000 + Math.random() * 9000)); }

// Lado do óculos: abre uma "sala" com um código de 4 números.
export class SalaJogador {
  // canvasVideo: canvas pequeno que vira o vídeo enviado ao Mestre
  constructor({ canvasVideo, aoMensagem, aoMudar }) {
    this.canvasVideo = canvasVideo;
    this.aoMensagem = aoMensagem;
    this.aoMudar = aoMudar || (() => {});
    this.conexoes = new Set();
    this.peer = null;
    this.estado = 'desligada'; // desligada | abrindo | esperando | conectado | erro
    this.erro = '';
    try { this.codigo = localStorage.getItem(CHAVE_CODIGO) || novoCodigo(); } catch (e) { this.codigo = novoCodigo(); }
  }

  get aberta() { return this.estado === 'esperando' || this.estado === 'conectado'; }

  _mudar(estado, erro = '') { this.estado = estado; this.erro = erro; this.aoMudar(this); }

  async abrir(tentativas = 3) {
    if (this.peer) return;
    this._mudar('abrindo');
    try { await carregarPeerJS(); } catch (e) { this._mudar('erro', e.message); return; }
    const peer = new window.Peer(PREFIXO + this.codigo, { debug: 1 });
    this.peer = peer;
    peer.on('open', () => {
      try { localStorage.setItem(CHAVE_CODIGO, this.codigo); } catch (e) { /* ignore */ }
      this._mudar(this.conexoes.size ? 'conectado' : 'esperando');
    });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && tentativas > 0) {
        // outro aparelho já usa esse código: sorteia outro
        this.fechar(); this.codigo = novoCodigo(); this.abrir(tentativas - 1);
        return;
      }
      if (e.type === 'peer-unavailable') return;
      this._mudar('erro', e.type === 'network' || e.type === 'server-error'
        ? 'Sem conexão com a internet para o Modo Mestre.' : `Erro na conexão (${e.type}).`);
    });
    peer.on('disconnected', () => { if (this.peer === peer && !peer.destroyed) peer.reconnect(); });
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        this.conexoes.add(conn);
        this._mudar('conectado');
        // manda o vídeo do que o jogador está vendo
        if (!this.stream) this.stream = this.canvasVideo.captureStream(12);
        peer.call(conn.peer, this.stream);
      });
      conn.on('data', (msg) => this.aoMensagem(msg, conn));
      const sair = () => {
        this.conexoes.delete(conn);
        if (this.peer) this._mudar(this.conexoes.size ? 'conectado' : 'esperando');
      };
      conn.on('close', sair);
      conn.on('error', sair);
    });
  }

  enviar(msg) {
    for (const c of this.conexoes) { try { if (c.open) c.send(msg); } catch (e) { /* ignore */ } }
  }

  fechar() {
    const p = this.peer;
    this.peer = null;
    this.conexoes.clear();
    if (p) p.destroy();
    this._mudar('desligada');
  }
}
