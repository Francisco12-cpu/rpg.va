# RPG VA

Óculos de realidade aumentada para a mesa de RPG: o celular vai dentro de um óculos VR,
a câmera traseira mostra a mesa de verdade e o app desenha coisas por cima.

O plano completo está em [`docs/PLANO.md`](docs/PLANO.md).

## Fase atual: 1 — base do óculos

- Câmera traseira em tela cheia.
- **👓 Modo óculos:** tela dividida pros dois olhos, com correção da curvatura da lente
  (reaproveitada do projeto *cacador-de-sinal*). Entra em tela cheia e deita a tela.
- **Camada de desenho** com o mesmo tamanho da imagem da câmera: as próximas fases desenham
  nela (grade, caminho, armadilhas) e o desenho fica grudado no lugar certo da imagem.
- **HUD dentro da imagem** (aparece nos dois olhos): FPS e avisos.
- **🎯 Moldura de teste:** cantos, cruz no centro e pontinhos. Serve para conferir o alinhamento.
- **🔧 Ajustar:** distância entre as imagens, altura, tamanho e curvatura. Fica salvo no celular.

## Como abrir

**Pelo GitHub Pages (mais fácil):** abra no Chrome do celular
**https://francisco12-cpu.github.io/rpg.va/** e aceite a câmera.

**Pelo PC (sem GitHub):** dois cliques em `INICIAR-SERVIDOR.bat`, aponte o celular para o
QR Code (mesmo Wi-Fi). No aviso "conexão não particular": **Avançado → Continuar**.

**Teste no PC sem câmera:** botão *Testar com foto da mesa*, ou abra com `?foto` no fim do
endereço (`?foto&oculos` já entra no modo óculos).

## Usando

| Botão | Tecla | O que faz |
|---|---|---|
| 👓 | O | liga/desliga o modo óculos |
| 🔧 | A | ajustar o óculos |
| 🎯 | T | moldura de teste |
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
assets/             foto de teste da mesa
servidor/           servidor HTTPS local (Python, só biblioteca padrão)
docs/PLANO.md       plano em fases
```
