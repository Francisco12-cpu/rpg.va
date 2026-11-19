# Plano — RPG VA

Óculos de realidade aumentada (celular num óculos VR) para a mesa de RPG.
A câmera do celular mostra a mesa de verdade e o app desenha coisas por cima,
que **só quem está de óculos vê**.

## Como funciona

- **Sozinho:** o óculos lê a mesa e gera tudo, sem ninguém mexer.
- **Painel do Mestre (opcional):** no PC ou em outro celular. Mostra ao vivo o
  que o jogador vê e deixa o mestre mudar as coisas. Sem o painel, o jogo roda igual.

## O que a mesa tem (pelas fotos)

- Tabuleiro branco plastificado com grade roxa → a grade é o "marcador" (sem QR Code).
- Bonecos de papelão com desenho de caneta azul, presos em massinha cinza.
- Dados coloridos (azul, branco translúcido, vermelho, verde, d6 branco de bolinhas vermelhas).
- Medalhão redondo com foto (o "cinto") → Mago Louco.

## Fases

| # | Fase | Situação |
|---|---|---|
| 1 | **Base do óculos**: câmera em tela cheia, tela dividida pros dois olhos com correção da lente, camada de desenho por cima, HUD dentro da imagem | ✅ feito |
| 2 | **Ler o tabuleiro**: achar a grade roxa e saber em qual casa cada ponto da imagem está | próxima |
| 3 | **Caminho + linhas-armadilha**: o app sorteia um caminho e linhas tipo laser em cima da grade; acha os bonecos pela massinha cinza e dispara se um boneco cruzar a linha | |
| 4 | **Dados → monstros 3D**: dado no tabuleiro vira um modelinho em cima dele; o monstro depende da cor (e do número no d6); tapou/tirou o dado, o monstro some; dado branco tem regra especial | |
| 5 | **Medalhão → Mago Louco** | |
| 6 | **Painel do Mestre**: câmera do jogador ao vivo, sortear de novo, ligar/desligar, editar a tabela dado→monstro, chamar o Mago | |
| 7 | Publicar e testar na mesa | contínuo |

## Limites conhecidos

- Cor do dado e bolinhas do d6: dá para ler no celular, sem internet.
- Número de d20/d12/d10/d8/d4: difícil no celular. Fica para depois, com IA (internet + chave de API, que fica no servidor do PC, nunca no GitHub).
- O tabuleiro plastificado reflete a luz: luz de lado ajuda.

## Dúvidas em aberto

- "Dado T3": é o dado mostrando **3** ou um **tipo** de dado?
- Regra do **dado branco**: monstro mais forte, chefe ou inverte algo?
