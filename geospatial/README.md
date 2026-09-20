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
