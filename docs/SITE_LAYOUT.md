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
