# Protótipo 3D — Centro Histórico de Salvador

## Objetivo
Construir em `/` uma cena Babylon.js jogável e deliberadamente limitada ao eixo Praça Tomé de Souza–Rua Chile–Elevador Lacerda–Mercado Modelo, com blockout arquitetônico/topográfico, duas câmeras, navegação em primeira pessoa e modo de inspeção.

## Implementação
- Instalar Babylon.js e montar a cena somente no navegador, preservando o projeto React + TypeScript existente.
- Obter e versionar um recorte de referência real (OSM/GeoJSON) para footprints, alinhamentos e vias do perímetro; converter longitude/latitude para coordenadas locais em metros, com o Elevador Lacerda em `(0, 0, 0)`, `Y` vertical, `X` leste/oeste e `Z` norte/sul.
- Centralizar toda geometria semântica e metadados em `site-data.json`: edifícios, segmentos do Elevador, vias, praça, níveis, pontos `upperEntrance`, `lowerEntrance` e `elevatorPath`, fonte e `estimated` em cada medida.
- Criar um terreno contínuo em tiles, com Cidade Alta, encosta, contenções e Cidade Baixa; gerar a superfície a partir de amostras de elevação provisórias claramente marcadas e deixá-la pronta para substituir por dados altimétricos reais.
- Separar módulos de terreno, ruas, edifícios, Elevador, câmeras, jogador e sobreposição de debug. Manter os volumes nomeados individualmente e usar instâncias apenas nos volumes genéricos repetidos.
- Representar torre superior, passarela, torre inferior e acessos do Elevador como objetos distintos, incluindo um ponto de substituição futura por `elevador_lacerda.glb`.
- Adicionar câmera aérea orbitável e câmera de rua na praça; controles WASD, mouse, gravidade e colisões básicas; ações para alternar câmeras, voltar à vista aérea e ativar/desativar debug.
- No debug, exibir eixos, grade, nomes dos elementos e indicação visual de dados `ESTIMATED`.
- Aplicar uma interface técnica discreta com legenda por categoria, estado da câmera e orientação geográfica, sem detalhes decorativos.
- Atualizar metadados da página e README com o fluxo para trocar GeoJSON, elevação e GLB.

## Estrutura técnica
- `src/data/site-data.json` e tipos/conversores geográficos separados da renderização.
- `src/game/` dividido em `terrain`, `roads`, `buildings`, `elevator`, `cameras`, `player` e `debug`.
- Babylon.js com malhas independentes, colisões nativas, cena otimizada e descarte completo no desmontar.
- Valores sem fonte métrica confiável serão explicitamente `estimated: true`; não serão apresentados como medidas oficiais.

## Validação
- Conferir compilação e ausência de erros no navegador.
- Testar as duas câmeras, WASD, colisões e botões de debug/aérea.
- Validar em desktop e celular que a cena está iluminada, enquadrada e sem sobreposição da interface.
- Confirmar visualmente a leitura Cidade Alta → encosta/Elevador → Cidade Baixa/Mercado Modelo e inspecionar os metadados dos principais objetos.
