# Implantação do sítio

## Princípio

A implantação normal da cena é geoespacial e versionada:

```text
OSM / CONDER / fontes documentais
        ↓
raw → normalized → derived
        ↓
runtime
```

Coordenadas X/Z de ruas, espaços e footprints não devem ser deslocadas manualmente para melhorar
aparência. Quando existe uma geometria OSM versionada, objetos curados referenciam essa geometria
por `footprintOsmId` em vez de copiar listas de vértices para `site-data.json`.

Geometrias procedurais e envelopes estimados continuam disponíveis apenas como fallback de
desenvolvimento e precisam permanecer explicitamente identificados como tal.

## Elevador Lacerda

O Elevador é a origem local da cena.

- origem local: centro do OpenStreetMap way `59224731`;
- torre principal: `footprintOsmId=59224731`;
- altura registrada: 72 m;
- o runtime hidrata o footprint diretamente de `geospatial/derived/site-vectors.json`;
- `layoutConstraints.elevatorExclusion` referencia o mesmo OSM id, sem duplicar vértices;
- a máscara normal do terreno usa o footprint canônico hidratado;
- `terrain.cutouts/elevador-lacerda-footprint-clearance` mantém uma cópia do polígono somente como
  snapshot de recuperação do terreno procedural, declarada por `fallbackSnapshotOfOsmId=59224731`.

O snapshot procedural não é uma segunda fonte cartográfica. O validador exige que ele permaneça
idêntico ao footprint OSM canônico enquanto existir.

### Passarela superior

Corredores OSM `highway=corridor + indoor=yes` não são tratados como ruas de terreno.

O produto derivado preserva separadamente:

- `way/59409445`: ligação elevada entre a torre e a transição superior;
- `way/1455480196`: continuação até a Praça Tomé de Souza;
- `way/1455480198`: trecho interno da torre.

No runtime persistente, esses eixos geram um deck elevado caminhável e com colisão. A elevação do
deck é ancorada no lado superior da encosta, portanto a passarela não é drapeada pela superfície
CONDER. As antigas caixas `lacerda-walkway` e `lacerda-upper-access` permanecem somente como
fallback quando os corredores derivados não estão disponíveis.

## Palácio Thomé de Souza / Prefeitura

O IPHAN documenta o Terreno à Praça Tomé de Souza (TPTS) com aproximadamente 46 × 50 m e descreve
o Palácio como um corpo longitudinal central com aproximadamente 16 m de largura.

O objeto curado usa `footprintOsmId=1317127245`. Esse way não possui nome no snapshot OSM, por
isso a identificação é registrada como uma correlação documental e geométrica, não como uma
atribuição nominal do OSM:

- o polígono está integralmente dentro do envelope TPTS documentado;
- mede aproximadamente 15,2 × 44,2 m;
- a dimensão curta é compatível com a faixa central de ~16 m descrita pelo IPHAN.

A altura do blockout continua estimada até existir uma fonte vertical mais confiável.

O envelope TPTS e o plateau de `site-data.json` são recursos de fallback procedural. Com o terreno
CONDER persistente ativo, o runtime não substitui a topografia oficial por esse plateau estimado.

## Praça Tomé de Souza

A geometria persistente da praça vem do OSM way `1263035782`.

O snapshot OSM atual traz `leisure=park` sem `surface`, mas referências visuais documentam piso
pétreo. O manifesto aplica um override de apresentação `stone` para esse OSM id:

- as tags OSM não são alteradas;
- o polígono não é redesenhado;
- a malha continua seguindo o terreno CONDER;
- uma futura `surface` explícita incompatível no OSM tem precedência sobre o override.

## Vias

As vias do runtime normal vêm de `site-vectors.json`; `site-data.json` não contém uma segunda rede
viária manual.

Regras de implantação relevantes:

- geometria X/Z preservada do OSM;
- largura: `width` explícito → `lanes × 3 m` estimado → fallback por classe;
- crossfall de gameplay limitado a 6%;
- perfil longitudinal raise-only limitado a 14% quando estruturalmente viável;
- junctions derivados somente entre endpoints compatíveis;
- indoor corridors são excluídos dessa coleção.

## Mercado Modelo e Palácio Rio Branco

Os dois marcos usam footprints canônicos do produto derivado:

- Mercado Modelo: `footprintOsmId=59392558`;
- Palácio Rio Branco: `footprintOsmId=402383814`.

`site-data.json` não deve voltar a copiar os vértices desses footprints.

## Fallback procedural

O terreno procedural, seus cutouts e plateaus existem para recuperação/desenvolvimento quando o
produto persistente não está disponível.

Eles não devem:

- sobrescrever o terreno CONDER no runtime normal;
- ser apresentados como levantamento topográfico;
- criar novas coordenadas X/Z para substituir geometrias OSM existentes;
- virar uma segunda fonte de verdade para footprints já versionados.

## Validação

Executar:

```bash
npm run geospatial:validate
npm run layout:validate
npm run landmark:fidelity-test
npm run terrain:validate
```

O workflow `Quality` executa as validações de implantação junto com typecheck, lint, testes de
vias/junctions/terreno/prédios e build.

Entre outros contratos, a validação verifica:

- referências `footprintOsmId` existentes e sem vértices duplicados;
- igualdade do snapshot procedural do Elevador com o footprint OSM canônico;
- relação do Palácio Thomé de Souza com o envelope IPHAN;
- continuidade torre → passarela → Praça Tomé de Souza;
- ausência de blockouts automáticos sobre superfícies viárias;
- limites geométricos das vias e junctions.

## Regra permanente

Quando um elemento parece desalinhado, primeiro deve ser determinado se a causa é a fonte,
transformação, classificação, terreno ou renderer. Não corrigir a cena deslocando coordenadas reais
ou criando geometria paralela apenas para fazê-la parecer certa.
