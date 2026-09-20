# Salvador Historic Core

Protótipo web 3D jogável do Centro Histórico de Salvador, com foco inicial no eixo Praça Tomé de Souza ↔ Elevador Lacerda ↔ Cidade Baixa/Mercado Modelo.

O projeto usa React, TypeScript e Babylon.js, mas a geometria urbana não é inventada no renderer: o objetivo é manter terreno, vias, espaços e edifícios ancorados em fontes cartográficas auditáveis.

## Estado atual

A cena já opera prioritariamente com uma base geoespacial persistente e versionada:

- terreno derivado das curvas oficiais CONDER 1992/24 em grade de 2,5 m;
- vetores OSM persistentes para ruas, espaços e footprints;
- cobertura completa das vias críticas configuradas no manifesto;
- origem local no Elevador Lacerda;
- coordenadas locais em metros, com transformação WGS84 ↔ UTM 24S ↔ X/Z local;
- ruas caminháveis com largura/proveniência preservadas e materiais derivados de tags OSM;
- junctions viários derivados apenas de endpoints compatíveis;
- player sincronizado com a superfície caminhável real da cena;
- terreno procedural e consultas live mantidos somente como fallback/diagnóstico.

A base persistente é validada por CI antes de ser considerada pronta para runtime.

## Área de trabalho

O perímetro cobre o núcleo imediato de:

- Praça Tomé de Souza;
- Rua Chile;
- Elevador Lacerda;
- Palácio Rio Branco e Prefeitura;
- encosta Cidade Alta/Cidade Baixa;
- Ladeira da Montanha;
- Rua da Conceição da Praia;
- Avenida Lafayete Coutinho;
- acesso inferior e Mercado Modelo.

Não é objetivo desta fase modelar toda Salvador.

## Regra de fidelidade

- não inventar ruas, praças ou edifícios para preencher lacunas;
- preservar identidade e provenance das features OSM;
- manter medidas estimadas explicitamente marcadas como `estimated`;
- separar dados de renderização;
- usar o terreno geoespacial ativo como referência vertical;
- tratar o terreno procedural apenas como fallback de desenvolvimento;
- promover blockouts automáticos somente quando a geometria e a altura tiverem suporte suficiente;
- preferir dados municipais MDT/LiDAR futuramente, se surgir fonte pública estável e adequada ao recorte.

## Pipeline geoespacial

```text
fontes oficiais/reais
        ↓
geospatial/raw
        ↓
geospatial/normalized
        ↓
geospatial/derived
        ↓
src/data/geospatial-base.json
        ↓
Babylon.js
```

Detalhes de CRS, fontes, políticas de terreno, vias, junctions, máscaras e blockouts estão em [geospatial/README.md](geospatial/README.md) e [geospatial/manifest.json](geospatial/manifest.json).

## Desenvolvimento

```bash
npm install
npm run dev
```

Validação completa:

```bash
npm run geospatial:validate
npm run road:test
npm run road:junction-test
npm run road:junction-surface-test
npm run road:junction-terrain-fit-test
npm run road:grading-test
npm run road:terrain-fit-test
npm run player:spawn-test
npm run terrain:mask-test
npm run building:grounding-test
npm run build
```

A workflow `Quality` executa o conjunto oficial de validações da branch.

## Atualização dos dados

Vetores:

```bash
npm run geospatial:refresh:vectors
```

Terreno:

```bash
npm run geospatial:refresh:terrain
```

Pipeline completo:

```bash
npm run geospatial:refresh
```

Atualizações externas devem ser importadas, normalizadas, derivadas, validadas e então versionadas. Dados live não substituem silenciosamente o produto persistente.
