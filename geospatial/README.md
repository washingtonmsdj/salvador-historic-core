# Base geoespacial

Esta pasta é a fonte cartográfica do protótipo. A regra daqui em diante é:

```
fontes reais -> raw -> normalized -> derived -> Babylon.js
```

O terreno procedural antigo continua disponível apenas como fallback de desenvolvimento.

## CRS e origem

- horizontal: EPSG:32724 (UTM 24S, metros);
- origem local: centro do Elevador Lacerda;
- X: deslocamento leste/oeste em metros;
- Z: deslocamento norte/sul em metros;
- Y: elevação.

O arquivo `manifest.json` registra as fontes, comandos e caminhos oficiais do pipeline.

Cada importação preserva duas camadas:

- `raw/`: resposta original da fonte externa, sem transformação;
- `normalized/`: geometrias transformadas para EPSG:32724 e coordenadas locais em metros.

A camada `derived/` fica reservada para produtos gerados, como TIN/heightfield/GLB.

## Camadas

### OSM

Usado para:

- ruas;
- praças;
- footprints;
- edifícios;
- referências urbanas.

Importação e derivação:

```bash
npm run geospatial:import:osm
npm run geospatial:derive:vectors
```

O produto `geospatial/derived/site-vectors.json` contém:

- centerlines de vias recortadas ao perímetro;
- praças/espaços explicitamente mapeados;
- footprints de edifícios;
- provenance e tags OSM.

Ruas e espaços podem ser usados diretamente no runtime depois da validação. Footprints de
edifícios não são transformados automaticamente em volumes quando não existe altura/modelo
confiável.

### CONDER

A camada oficial preparada é `REL_Curva_Nivel_L`, layer 14 da Cartografia Sistemática
1992/24. Ela trabalha em EPSG:32724 e expõe `ELEVATION`.

Importação:

```bash
npm run geospatial:import:conder
```

### Prefeitura de Salvador

A cartografia municipal documenta ortofotos, LiDAR e MDT. Quando um endpoint ou arquivo público
estável do recorte estiver identificado, o MDT municipal deve ter prioridade sobre a superfície
derivada apenas de curvas de nível.

## Build derivado

Depois da importação altimétrica:

```bash
npm run geospatial:derive:terrain
npm run geospatial:build
npm run geospatial:validate
```

O derivador transforma as curvas normalizadas numa grade regular de 2,5 m usando as cotas das
curvas como restrições fixas e relaxação harmônica apenas entre elas.

Para atualizar por fonte:

```bash
npm run geospatial:refresh:vectors
npm run geospatial:refresh:terrain
```

Para atualizar toda a cadeia:

```bash
npm run geospatial:refresh
```

O build gera `src/data/geospatial-base.json`, que informa ao runtime quais camadas foram
importadas e quais produtos derivados estão realmente prontos para uso.

Importar OSM ou CONDER não muda automaticamente a cena para "base real". O runtime só deixa de
mostrar fallback depois que existir um produto em `geospatial/derived/` que o Babylon consuma.
Nenhum fallback procedural pode ser apresentado como dado real.


## Blockouts de edifícios OSM

A cena pode promover footprints OSM para blockouts 3D apenas quando **vetores e terreno
geoespaciais estiverem ativos ao mesmo tempo**.

Critérios automáticos:

- footprint poligonal válido;
- `height` explícita ou altura derivada de `building:levels`;
- footprint não pode sobrepor um marco já curado separadamente;
- variação do terreno sob o footprint não pode ultrapassar 0,75 m;
- a elevação da fundação é amostrada do terreno geoespacial ativo;
- qualquer volume automático continua marcado como blockout estimado.

Footprints em encosta forte são deliberadamente ignorados até receberem uma fundação ou modelo
específico. Quando essa base entra em operação, os placeholders genéricos do tipo `rua-chile`
são removidos do runtime.


## Referência raster no terreno

Enquanto os produtos vetoriais e o MDT/heightfield real ainda estão sendo materializados, o
Preview pode exibir uma camada raster do OpenStreetMap diretamente sobre a superfície 3D.

Essa camada:

- usa o mesmo bbox WGS84 calculado a partir do perímetro local;
- é convertida para o mesmo sistema X/Z centrado no Elevador Lacerda;
- acompanha a altura do terreno apenas para comparação visual;
- não gera ruas, colisões, edifícios ou gameplay;
- fica abaixo das superfícies 3D de ruas e praças;
- possui limite explícito de tiles e attribution visível;
- pode ser desligada pelo botão `Mapa no terreno`.

A finalidade é detectar imediatamente desalinhamentos entre blockouts e cartografia real. Ela não
substitui a promoção de OSM/CONDER para `geospatial/derived/`.


## Seed OSM versionada

Enquanto o import completo do bbox ainda não pode ser executado neste ambiente, o runtime usa uma
seed parcial extraída de `public/data/osm-reference.json`.

A seed atual contém somente features já versionadas e verificáveis:

- Rua Chile — OSM way 258560240;
- Praça Tomé de Souza — OSM way 1263035782;
- Elevador Lacerda — OSM way 59224731.

O estado do runtime é `geospatial-hybrid`: as features reais substituem/acompanham somente os
equivalentes cobertos pela seed; features ainda não materializadas continuam explicitamente em
fallback.

O perímetro Z foi ampliado para ±300 m para conter o trecho verificado de Rua Chile sem mover a
origem do Elevador.


## OSM ao vivo no Preview

O navegador pode consultar um recorte pequeno do Overpass diretamente em runtime. A consulta é
assíncrona e nunca bloqueia a abertura da cena.

Regras:

- usa somente o bbox atual do projeto;
- consulta vias, áreas urbanas e footprints de edifícios;
- transforma WGS84 para a mesma projeção UTM 24S usada pelo projeto;
- mantém cache apenas na sessão do navegador por 15 minutos;
- tenta dois endpoints Overpass antes de desistir;
- se a rede falhar, mantém a seed versionada sem quebrar a cena;
- quando a consulta funciona, ruas e áreas do Preview são atualizadas automaticamente;
- footprints de edifícios são mostrados como guias de alinhamento enquanto o terreno oficial ainda
  não estiver ativo;
- OSM ao vivo não altera `geospatial/derived/` e não muda a provenance persistida do projeto.

A promoção definitiva continua exigindo importação, revisão e versionamento dos dados.


## CONDER ao vivo no Preview

O Preview também pode consultar diretamente a camada oficial `REL_Curva_Nivel_L` da CONDER e
gerar um heightfield temporário durante a sessão.

Regras do modo live:

- consulta somente o envelope EPSG:32724 do projeto;
- rejeita respostas ArcGIS marcadas como parciais por `exceededTransferLimit`;
- recorta as curvas ao perímetro local antes da interpolação;
- usa grade de 5 m, amostragem de curvas a cada 2,5 m e no máximo 750 iterações;
- resolve as células não medidas por interpolação harmônica com as curvas como constraints fixas;
- usa o menor valor derivado como datum vertical temporário;
- mantém cache somente em `sessionStorage` por 15 minutos;
- se a consulta ou derivação falhar, conserva o terreno procedural sem interromper a cena;
- quando funciona, reconstrói terreno, mapa raster, ruas, áreas e guias OSM sobre a nova superfície;
- não grava nem modifica `geospatial/derived/terrain.json`.

O modo live é uma ferramenta de validação visual. A malha persistida continua exigindo a importação
oficial, derivação de 2,5 m, validação e versionamento pelo pipeline `geospatial:refresh:terrain`.


## Blockouts OSM ao vivo

Quando o Preview dispõe simultaneamente de terrain geoespacial ativo e footprints OSM ao vivo,
ele pode promover automaticamente apenas edifícios que atendem à política conservadora definida
em `buildingBlockoutPolicy`.

Um footprint só vira volume quando:

- possui polígono OSM válido;
- possui `height` explícito ou altura derivável de `building:levels`;
- não pertence à lista de marcos protegidos;
- não sobrepõe footprints curados de marcos já modelados;
- a variação de relevo sob a fundação fica dentro do limite configurado.

Os blocos provisórios da Rua Chile só são removidos se um footprint promovido realmente os
sobrepuser. Edifícios sem altura ou sobre encosta excessiva permanecem apenas como guia de footprint.

Essa promoção é temporária da sessão. Ela não grava novas dimensões em `site-data.json` nem
promove dados live para `geospatial/derived/`.


## Contrato de fidelidade viária

O Preview não deve desenhar manualmente a via da encosta para “parecer correta”. A **Ladeira da
Montanha** é tratada como feature geoespacial e só pode entrar pela geometria OSM.

Vias-chave auditadas no recorte:

- Rua Chile;
- Ladeira da Montanha;
- Rua da Conceição da Praia;
- Avenida Lafayete Coutinho.

O carregamento vetorial segue esta ordem:

1. Overpass principal;
2. Overpass alternativo;
3. API direta `/api/0.6/map?bbox=...` do OpenStreetMap;
4. seed versionada somente se todas as fontes live falharem.

A API direta é usada apenas para o bbox pequeno do projeto. Os nós de cada `way` são reconstruídos,
projetados para UTM 24S e convertidos para X/Z locais. Portanto a posição da rua vem do mapa, não de
coordenadas inventadas no renderer.

Quando uma via não possui `width`, uma largura continua sendo explicitamente estimada. Se houver
`lanes`, o Preview usa `lanes × 3 m` como estimativa identificada; a geometria do eixo permanece
a geometria OSM real.

Nas encostas, cada borda da faixa viária amostra separadamente o terreno ativo para evitar que a
rua atravesse a ribanceira ou flutue por usar apenas a cota do eixo central.

## Coordenadas do perímetro

Os quatro cantos do terreno são armazenados simultaneamente como:

- X/Z locais em metros;
- UTM 24S (EPSG:32724);
- latitude/longitude WGS84.

O runtime também possui transformação inversa X/Z → UTM → WGS84, portanto qualquer ponto da cena
pode receber coordenadas geográficas sob demanda. No modo Debug, os quatro cantos exibem essas
coordenadas para conferência visual.


## Endpoint OSM same-origin

O Preview não depende mais apenas de chamadas cross-origin feitas pelo browser. O servidor do app expõe:

`GET /api/geospatial/osm`

O endpoint:

- usa exclusivamente o bbox versionado do projeto;
- consulta Overpass no servidor;
- tenta a API bbox oficial do OpenStreetMap como fallback;
- devolve JSON Overpass ou XML OSM preservando a geometria original;
- aplica cache HTTP curto;
- não aceita bbox arbitrário do cliente e, portanto, não funciona como proxy aberto.

O browser tenta essa rota primeiro. Chamadas diretas aos provedores externos ficam apenas como fallback.

Com dados OSM ativos, as ruas fallback manuais são substituídas por centerlines reais. O dataset
curado não contém mais a via inferior inventada nem eixos extrapolados de Rua Chile; quando o
live falha, a cena mostra apenas vetores já versionados e verificáveis.


## Contrato de cobertura parcial

Uma resposta OSM com features válidas não é automaticamente considerada cobertura completa.

As vias críticas do recorte são declaradas uma única vez em `geospatial/manifest.json` e a
importação persistente registra `criticalRoadCoverage` com contagem, ausências e estado de
completude. O produto derivado preserva o mesmo metadado.

No Preview, uma resposta live parcial funciona como **overlay** sobre os vetores versionados:
features com o mesmo nome são atualizadas pela geometria live, mas ruas versionadas que não vieram
na resposta não são apagadas. Isso evita o caso em que uma resposta incompleta do Overpass/API
faz o mapa aparentemente "perder" ruas.

Somente um produto persistente que declare `coverage: "complete"` e contenha todas as vias críticas
pode ativar o modo `geospatial-derived` sem fallback. O validador cruza o metadado declarado com
os nomes realmente presentes em `site-vectors.json`; portanto não é possível promover cobertura
completa apenas aumentando a contagem total de features.


## Endpoint CONDER same-origin

O Preview tenta primeiro `GET /api/geospatial/conder`.

A rota do app:

- usa exclusivamente o envelope UTM EPSG:32724 versionado do projeto;
- não aceita envelope ou camada arbitrária enviados pelo cliente;
- consulta a camada oficial `REL_Curva_Nivel_L` da CONDER;
- rejeita erro ArcGIS, resposta vazia e `exceededTransferLimit`;
- aplica cache HTTP curto;
- devolve as curvas originais em JSON para o mesmo pipeline de normalização do browser.

Somente se essa rota falhar o browser tenta a CONDER diretamente. O painel de debug mostra qual
provedor foi usado.

O import persistente segue o mesmo princípio de integridade: respostas parciais são rejeitadas e
nenhum produto normalizado é promovido se menos de duas curvas utilizáveis sobreviverem.


## Identidade OSM no overlay

Vias e áreas derivadas preservam `osmType`, `osmId` e tags de origem até o runtime.

Quando uma resposta live é mesclada com a base versionada, uma feature geoespacial existente só é
substituída automaticamente se a mesma identidade OSM estiver presente no overlay. O nome deixa de
ser a chave primária para features OSM, porque uma rua pode ser composta por vários `way` distintos
com o mesmo nome.

A comparação por nome continua apenas para fallbacks manuais sem identidade OSM. Isso permite que
um vetor real substitua um placeholder legado sem apagar outros trechos reais homônimos.
