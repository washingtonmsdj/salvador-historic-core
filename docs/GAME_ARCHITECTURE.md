# Arquitetura de gameplay

O projeto agora separa a experiência jogável em quatro fronteiras simples:

```text
Babylon.js / renderer
        ↓ posição e interação
GameSession / simulação persistível
        ↓ snapshot imutável
React DOM / HUD e menus
```

## Responsabilidades

- `src/game/game-session.ts`: missão ativa, checkpoints, recompensa, XP, distância até o objetivo e persistência versionada em `localStorage`.
- `src/game/third-person-player.ts`: movimento, colisão, câmera e emissão de posição/interação.
- `src/components/game-hud.tsx`: HUD de baixo ruído, sem colocar texto de gameplay dentro do canvas.
- `src/components/salvador-scene.tsx`: composição do mundo, carregamento geoespacial e ligação entre runtime 3D e sessão.

## Vertical slice atual

`Rota do Centro Histórico` usa os pontos já presentes nos dados versionados:

1. acesso superior do Elevador Lacerda;
2. acesso inferior do Elevador Lacerda;
3. Mercado Modelo.

Cada etapa exige chegar ao raio do ponto e pressionar `E`. A sessão concede dinheiro e XP, salva o progresso e exibe o próximo objetivo. A terceira pessoa é a câmera inicial para que a primeira tela já seja jogável; o mapa e o debug continuam disponíveis como superfícies auxiliares.

## Regras de evolução

- regras de gameplay novas entram na sessão/simulação, não em callbacks de mesh;
- coordenadas de missão devem vir de dados geoespaciais ou manifestos, nunca de posições espalhadas pela UI;
- o renderer pode ser recriado sem perder o progresso salvo;
- menus e mapas devem pausar o input de gameplay enquanto estiverem abertos;
- NPCs, veículos, inventário e combate devem seguir o mesmo padrão de estado serializável + controlador de runtime + HUD contextual.

## Próximas fatias recomendadas

1. interação real do Elevador Lacerda, com transição upper/lower e telemetria de viagem;
2. NPCs ambientados e pedestres com pool de entidades e LOD;
3. veículos e tráfego com lanes derivados das vias OSM;
4. sistema de contratos, reputação e economia conectado a locais históricos;
5. streaming por setores, qualidade adaptativa e playtest automatizado com screenshots.
