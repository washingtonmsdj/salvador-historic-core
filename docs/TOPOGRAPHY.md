# Topografia

## Estado atual

O runtime agora possui duas fontes possíveis de terreno:

1. **geospatial-derived** — grade gerada a partir de dados altimétricos normalizados;
2. **procedural-fallback** — blockout antigo baseado em perfis manuais.

A cena só ativa `geospatial-derived` quando `geospatial/derived/terrain.json` existe,
está marcado como disponível, cobre exatamente o perímetro do projeto e o manifesto runtime
`src/data/geospatial-base.json` também confirma a ativação.

Enquanto o recorte CONDER ainda não tiver sido importado e derivado neste repositório, o Preview
continua explicitamente em `procedural-fallback`. Os perfis de fallback permanecem em
`src/data/site-data.json` com `estimated: true`.

Invariantes usados pelo blockout atual:

- origem local: Elevador Lacerda;
- Cidade Baixa: datum local próximo de 0 m;
- Cidade Alta: aproximadamente 65 m para fins de blockout;
- Praça Cairu e acesso inferior permanecem no nível baixo;
- Praça Tomé de Souza e Rua Chile permanecem no platô alto;
- a linha da escarpa varia ao longo de Z, em vez de ser uma rampa uniforme;
- as vias são projetadas ponto a ponto sobre a superfície do terreno.

## Fonte oficial preparada para importação

A CONDER disponibiliza a camada de curvas de nível:

- serviço: `CARTOGRAFIA_SISTEMATICA_1992_24`;
- layer: `REL_Curva_Nivel_L` (14);
- geometria: polyline;
- atributo altimétrico: `ELEVATION`;
- CRS: EPSG:32724;
- endpoint:
  `https://mapas.conder.ba.gov.br/arcgis/rest/services/CARTOGRAFIA_SISTEMATICA/CARTOGRAFIA_SISTEMATICA_1992_24/MapServer/14`.

A Prefeitura de Salvador também documenta sua base cartográfica municipal com aerofotogrametria,
nuvem de pontos LiDAR, MDS e MDT. Quando um MDT municipal adequado ao recorte estiver disponível
por endpoint/arquivo estável, ele deve ter precedência sobre o blockout.

## Pipeline CONDER → heightfield

O repositório inclui:

```bash
npm run geospatial:import:conder
npm run geospatial:derive:terrain
npm run geospatial:build
npm run geospatial:validate
```

O importador:

1. lê o perímetro geoespacial canônico;
2. consulta apenas as curvas CONDER que cruzam esse envelope;
3. preserva a resposta ArcGIS original em `geospatial/raw/conder/`;
4. normaliza as curvas para X/Z locais em metros em
   `geospatial/normalized/conder/contours.json`.

O derivador gera `geospatial/derived/terrain.json` numa grade de 2,5 m:

- células atravessadas por curvas recebem a elevação oficial como restrição fixa;
- os intervalos entre curvas são preenchidos por relaxação harmônica;
- nenhuma cota de curva é movida pela interpolação;
- o menor valor resolvido define o datum vertical local do produto derivado;
- a superfície interpolada continua identificada como derivada, não como levantamento direto.

O teste `npm run geospatial:test:terrain` usa duas curvas sintéticas de 0 m e 20 m e verifica
que as duas cotas permanecem fixas e que o ponto médio converge para aproximadamente 10 m.

## Regra

Nenhum perfil provisório, interpolação visual ou ajuste de blockout pode ser promovido para
`estimated: false` sem fonte geográfica verificável.


## Perímetro de apresentação

O recorte visual do protótipo é uma maquete topográfica centrada no Elevador Lacerda:

- centro local: `X=0, Z=0`;
- extensão X: `-150 m .. +150 m`;
- extensão Z: `-230 m .. +230 m`;
- base estrutural: abaixo do datum da Cidade Baixa;
- o topo do terreno, as paredes laterais e a base formam uma estrutura fechada.

A centralização é validada por `npm run terrain:validate`. Esse comando também verifica
cobertura dos perfis e se os objetos/footprints permanecem dentro do perímetro.

## Materiais do blockout

O topo inteiro do terreno é sempre renderizado como uma superfície contínua. Isso evita buracos
ou áreas invisíveis caso a classificação visual de relevo falhe.

A leitura da topografia é composta por:

- material procedural claro e contínuo em todo o topo;
- camada rochosa apenas sobre trechos íngremes da escarpa;
- curvas de nível visuais em intervalos configurados no `site-data.json`;
- contorno superior do perímetro;
- paredes laterais estratificadas e base estrutural.

As texturas são geradas deterministicamente no navegador, sem dependências externas ou assets
de terceiros. Elas alteram apenas a leitura visual, não a geometria nem as cotas do terreno.

A camada rochosa é somente um acabamento visual deslocado poucos centímetros da superfície e não
participa das colisões. A malha contínua inferior permanece como a única superfície física do
terreno.

## Limite de fidelidade

Textura, camada rochosa, base estrutural e paredes do perímetro são elementos de apresentação.
Eles não devem ser confundidos com geologia ou acabamento oficial.

Quando a grade CONDER derivada estiver ativa, as curvas de origem são verificáveis, mas as alturas
entre elas são interpoladas. Por isso a malha derivada continua identificada como produto estimado
entre curvas. Um MDT/LiDAR municipal estável continua sendo a fonte preferencial para substituir
essa interpolação quando estiver disponível.
