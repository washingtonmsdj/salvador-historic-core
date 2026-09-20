# Topografia

## Estado atual

O terreno usado em runtime é um **blockout topográfico provisório 2D**, não um DEM e não uma
superfície levantada. Ele substitui a antiga rampa unidimensional e modela a escarpa ao longo dos
eixos X/Z com perfis de controle interpolados.

Os perfis estão em `src/data/site-data.json` e permanecem com `estimated: true`.

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

## Importador

O repositório inclui:

```bash
npm run terrain:import:conder
```

O importador:

1. lê os limites locais de `site-data.json`;
2. converte o envelope para o EPSG:32724 usando a origem projetada do Elevador;
3. consulta apenas as curvas que cruzam o perímetro do protótipo;
4. converte as coordenadas para X/Z locais em metros;
5. grava `src/data/terrain-contours.reference.json`.

O arquivo importado é referência bruta. A etapa seguinte é gerar uma superfície TIN/height field
a partir das curvas e então remover os perfis provisórios.

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

Textura, curvas de nível, camada rochosa, base estrutural e paredes do perímetro são elementos de
apresentação. Eles não devem ser confundidos com geologia ou acabamento oficial. A elevação continua
`estimated: true` até a substituição pelos dados altimétricos verificáveis.
