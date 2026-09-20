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
