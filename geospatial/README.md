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

Importação:

```bash
npm run geospatial:import:osm
```

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

Depois das importações:

```bash
npm run geospatial:build
npm run geospatial:validate
```

O build gera `src/data/geospatial-base.json`, que informa ao runtime quais camadas foram
importadas e quais produtos derivados estão realmente prontos para uso.

Importar OSM ou CONDER não muda automaticamente a cena para "base real". O runtime só deixa de
mostrar fallback depois que existir um produto em `geospatial/derived/` que o Babylon consuma.
Nenhum fallback procedural pode ser apresentado como dado real.
