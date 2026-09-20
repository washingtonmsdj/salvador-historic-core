# Implantação do sítio

## Princípio

A cena não pode posicionar elementos principais de forma independente. A implantação deve ser
derivada de referências geográficas ou de regras explícitas versionadas em
`src/data/site-data.json`.

## Elevador Lacerda

O Elevador é a âncora local da cena.

- origem local: `X=0, Z=0`;
- torre principal: footprint do OpenStreetMap way `59224731`;
- altura da torre principal: 72 m, conforme o mesmo registro;
- o terreno possui um cutout com o mesmo footprint da torre;
- nenhuma via pode entrar na zona de exclusão configurada em
  `layoutConstraints.elevatorExclusion`.

O cutout não inventa uma nova geometria do Elevador: ele apenas impede que a superfície do
terreno atravesse o volume verificado da torre.

## Palácio Tomé de Souza

O IPHAN documenta o Terreno à Praça Tomé de Souza (TPTS) com aproximadamente 46 m de largura
por 50 m de profundidade. O Palácio atual ocupa uma faixa longitudinal central de aproximadamente
16 m de largura, da Praça Tomé de Souza até a Ladeira da Misericórdia, com um pavimento elevado
sobre pilotis.

No blockout atual:

- o envelope do TPTS é derivado do bordo sudoeste verificado da Praça e mede 46 x 50 m;
- o footprint horizontal do Palácio mede 16 x 50 m e fica centralizado no TPTS;
- a implantação horizontal é tratada como verificada por fonte oficial;
- a altura vertical continua `estimated: true` porque a fonte consultada não informa a altura exata
  do edifício atual;
- o terreno e o Palácio não podem ser reposicionados manualmente sem atualizar as constraints.

Fonte: IPHAN, Anexo XXIII — Orientação para Agenciamento e Projeto, Terreno à Praça Tomé de Souza.


### Patamar topográfico do TPTS

O envelope do TPTS também controla o terreno. Como o IPHAN documenta uma ocupação semienterrada
que se estende por toda a área do terreno, com laje superior relacionada ao nível da Praça, o
blockout trata esse envelope como um patamar plano da Cidade Alta.

- footprint do patamar: idêntico ao envelope TPTS 46 x 50 m;
- cota local atual: 65,2 m, igual ao datum usado pela Praça Tomé de Souza no blockout;
- a geometria horizontal do envelope é derivada da fonte oficial;
- a cota vertical continua `estimated: true`;
- a transição nas bordas usa no máximo uma célula da malha para evitar degraus numéricos.

O patamar é aplicado antes dos cutouts. Portanto, recortes especiais como o do Elevador continuam
tendo precedência sobre a laje urbana.

## Praça Tomé de Souza

O polígono versionado da Praça Tomé de Souza é a referência de implantação do entorno imediato.

- volumes de edifícios não podem ter seu centro dentro da praça;
- o Palácio Thomé de Souza permanece um blockout de dimensões estimadas;
- sua implantação é derivada do bordo nordeste do polígono da praça;
- placeholders genéricos sem identidade/footprint foram removidos da cena.

## Rua Chile

O eixo-base vem do OpenStreetMap way `258560240`.

Os blockouts provisórios da Rua Chile:

- usam a mesma rotação derivada do eixo OSM;
- têm seus centros projetados sobre esse eixo;
- mantêm dimensões `estimated: true` até footprints reais serem importados.

Não criar rotações individuais para “fazer parecer alinhado”.

## Cidade Baixa e Mercado Modelo

O Mercado Modelo usa footprint verificado.

A via inferior é ainda provisória, mas deve obedecer duas regras:

1. não entrar na zona de exclusão do Elevador;
2. não atravessar o footprint do Mercado Modelo.

O corredor atual é de gameplay/blockout. Ele não deve ser apresentado como eixo viário oficial
até a importação da geometria OSM correspondente.

## Ladeira da Montanha

A antiga ribbon provisória foi removida porque atravessava o miolo da implantação sem geometria
verificada suficiente.

Ela só deve voltar à cena após importação de um traçado geográfico verificável. A ausência
temporária é preferível a uma via visualmente convincente, porém falsa.

## Validação

Executar:

```bash
npm run layout:validate
npm run terrain:validate
```

A validação de layout verifica, entre outros pontos:

- clearance entre vias e Elevador;
- correspondência entre footprint da torre e cutout do terreno;
- clearance da via inferior em relação ao Mercado Modelo;
- edifícios fora do polígono da praça;
- alinhamento dos blockouts da Rua Chile;
- orientação do Palácio Thomé de Souza em relação ao bordo da praça.


## Importação OSM do recorte

O repositório inclui um importador para substituir progressivamente blockouts estimados por
geometria aberta verificável:

```bash
npm run site:import:osm
```

O importador:

1. lê a origem e o perímetro em metros de `site-data.json`;
2. converte o bbox local para WGS84;
3. consulta dois endpoints Overpass com fallback;
4. busca todas as vias e edifícios dentro do recorte;
5. busca explicitamente Ladeira da Montanha, Palácio Thomé de Souza, Prefeitura e Câmara;
6. converte toda geometria recebida para X/Z em metros locais;
7. grava `src/data/osm-site.reference.json`.

O arquivo gerado é referência bruta e não deve ser renderizado automaticamente sem revisão.
A promoção de uma feature para `site-data.json` exige:

- identificação inequívoca;
- geometria compatível com o perímetro;
- provenance registrada;
- passagem em `layout:validate`.

Não substituir uma feature verificada por uma aproximação manual quando ela já estiver disponível
no arquivo de referência.


## Contrato de coordenadas do mapa

A cena não usa posicionamento visual livre para ruas ou edifícios de contexto.

- Todo ponto horizontal entra primeiro como WGS84 ou EPSG:32724.
- A origem projetada é o Elevador Lacerda.
- O runtime converte cada vértice para X/Z local em metros.
- Os quatro cantos do perímetro possuem WGS84 e UTM explícitos em `geospatial-base.json`.
- Footprints OSM preservam a geometria vértice a vértice; altura pode continuar estimada sem alterar a posição horizontal.
- Ruas são geradas da centerline OSM; em encosta, a centerline é reamostrada e drapeada sobre o terrain ativo.
- Quando OSM live não está disponível, somente geometrias já versionadas/verificadas podem ser desenhadas. Não existe ribbon rodoviário genérico de substituição.
- Blocos genéricos da Rua Chile não são mais usados como fallback; footprints reais entram quando disponíveis.

### Via da encosta do Elevador

A via histórica relevante é a **Ladeira da Montanha**. Ela é tratada como feature geoespacial crítica,
assim como Rua Chile, Rua da Conceição da Praia e Avenida Lafayete Coutinho.

A Ladeira deve:
1. vir de geometria OSM/API do recorte;
2. manter os vértices projetados em metros locais;
3. usar `elevationMode: terrain`;
4. ser amostrada densamente no runtime para acompanhar a ribanceira/terrain CONDER;
5. nunca ser substituída por uma faixa manual desenhada “parecida”.
