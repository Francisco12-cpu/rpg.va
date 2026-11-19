# RPG VA

Óculos de realidade aumentada para a mesa de RPG: o celular vai dentro de um óculos VR,
a câmera traseira mostra a mesa de verdade e o app desenha coisas por cima.

O plano completo está em [`docs/PLANO.md`](docs/PLANO.md).

## O que já funciona

**Fase 1 — base do óculos**
- Câmera traseira em tela cheia; **👓 modo óculos** com tela dividida e correção da lente
  (reaproveitada do *cacador-de-sinal*); **🔧 ajustes** salvos no celular.
- Camada de desenho com o tamanho da imagem da câmera + HUD dentro da imagem.

**Fase 2 — o óculos acha a grade do tabuleiro (sem QR Code)**
- Acha as linhas roxas do tabuleiro, monta a perspectiva e numera as casas (u,v).
- Só conta casas em cima do tabuleiro: fundo branco/cinza e linha escura nas bordas
  (madeira, cadeiras e pastas ficam de fora).
- Acompanha de um quadro para o outro, para a casa (0,0) continuar a mesma enquanto a cabeça mexe.
- **▦** mostra/esconde a grade; **🎯** mostra também os números das casas e as retas achadas.

**Modo Mestre — funciona direto pelo link do GitHub**
- No óculos, toque em **🧙**: aparece um **código de 4 números**.
- O Mestre abre **https://francisco12-cpu.github.io/rpg.va/mestre.html** (PC ou outro celular),
  digita o código e vê **ao vivo** o que o jogador vê.
- Do painel o Mestre manda **mensagens** que aparecem no óculos e liga/desliga a grade e os números.
- A conexão usa PeerJS (WebRTC): um servidor público só apresenta os dois aparelhos, e o vídeo
  vai direto de um para o outro. **Os dois precisam de internet**; no mesmo Wi-Fi funciona melhor.
  Em redes muito diferentes (ex.: um no 4G e outro num Wi-Fi com firewall) pode não conectar.

## Como abrir

**Pelo GitHub Pages (mais fácil):** abra no Chrome do celular
**https://francisco12-cpu.github.io/rpg.va/** e aceite a câmera.

**Pelo PC (sem GitHub):** dois cliques em `INICIAR-SERVIDOR.bat`, aponte o celular para o
QR Code (mesmo Wi-Fi). No aviso "conexão não particular": **Avançado → Continuar**.

**Teste no PC sem câmera:** botão *Testar com foto da mesa*, ou abra com `?foto` no fim do
endereço (`?foto&oculos` já entra no modo óculos; `?foto=assets/testes/4.jpg&debug` usa outra foto e liga a conferência).

## Usando

| Botão | Tecla | O que faz |
|---|---|---|
| 👓 | O | liga/desliga o modo óculos |
| 🔧 | A | ajustar o óculos |
| ▦ | G | mostrar a grade |
| 🎯 | T | moldura de teste + números + retas achadas |
| 🧙 | M | Modo Mestre (mostra o código) |
| — | N | números das casas |
| ✕ | Esc | volta para o início |

No modo óculos os botões somem: **toque na tela** para eles voltarem por 4 segundos.

## Estrutura

```
index.html          página + import map (Three.js por CDN)
css/style.css
js/main.js          início, laço de quadros, botões, modo óculos
js/fonte.js         câmera traseira ou foto de teste
js/camada.js        camada de desenho (coordenadas da imagem da câmera)
js/hud.js           painel de informações dentro da imagem
js/compositor.js    junta câmera + camada + HUD (+ 3D na Fase 4)
js/saida.js         tela normal ou dois olhos com correção da lente
js/grade.js         acha a grade do tabuleiro (Hough + homografia) e numera as casas
js/matriz.js        contas da homografia
js/sala.js          conexão óculos ⇄ Mestre (PeerJS)
mestre.html         Painel do Mestre
js/mestre.js        lógica do Painel do Mestre
assets/             foto de teste da mesa
servidor/           servidor HTTPS local (Python, só biblioteca padrão)
docs/PLANO.md       plano em fases
```
