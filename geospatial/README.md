# Base geoespacial

Esta pasta é a fonte cartográfica do protótipo. O contrato é:

```text
fontes reais/oficiais -> raw -> normalized -> derived -> runtime
```

O runtime normal usa os produtos persistentes de `geospatial/derived/` quando eles passam pelas validações. Consultas live e o terreno procedural existem somente como fallback, diagnóstico e apoio a refresh.

## Sistema de coordenadas

- CRS horizontal: EPSG:32724 (UTM 24S, metros);
- origem local: centro do Elevador Lacerda;
- X: deslocamento leste/oeste em metros;
- Z: deslocamento norte/sul em metros;
- Y: elevação local;
- o perímetro e os quatro cantos também possuem equivalentes WGS84.

O arquivo `manifest.json` registra fontes, políticas, comandos e limites de qualidade.

## Camadas persistentes ativas

### OpenStreetMap

O produto `geospatial/derived/site-vectors.json` contém:

- centerlines viárias recortadas ao perímetro;
- espaços urbanos/polígonos;
- footprints de edifícios;
- identidade OSM, tags, provenance e origem da largura/altura.

O modo `geospatial-derived` só pode ficar ativo quando o produto declara cobertura completa e contém todas as vias críticas definidas no manifesto:

- Rua Chile;
- Ladeira da Montanha;
- Rua da Conceição da Praia;
- Avenida Lafayete Coutinho.

O runtime persistente é a referência normal. Refresh live não apaga nem substitui silenciosamente features versionadas.

### CONDER

A fonte altimétrica persistente atual é a camada oficial `REL_Curva_Nivel_L`, layer 14 da Cartografia Sistemática CONDER 1992/24, em EPSG:32724.

As curvas normalizadas são convertidas em uma grade regular de 2,5 m por um solver harmônico com as cotas das curvas como restrições fixas. O produto final fica em `geospatial/derived/terrain.json`.

Essa derivação é geograficamente muito superior ao perfil procedural, mas não deve ser tratada como MDT/LiDAR moderno. Se a Prefeitura de Salvador publicar um MDT/LiDAR estável para o recorte, ele deve ser avaliado como fonte altimétrica preferencial.

## Vias e gameplay

As vias derivadas preservam a geometria OSM e amostram o terreno ativo.

Regras principais:

- espaçamento longitudinal de amostragem: 1,25 m;
- largura explícita do OSM é preservada quando disponível;
- quando não há `width`, um `lanes` inteiro válido gera largura estimada de faixa de rolamento usando 3 m por faixa;
- somente quando `width` e `lanes` não estão disponíveis é usado o fallback determinístico por classe `highway`;
- toda largura não explícita continua identificada como estimada e preserva `widthSource`;
- crossfall de gameplay é limitado a 6%;
- a inclinação longitudinal é limitada a 14% por um solver raise-only que trabalha nas duas bordas da pista;
- o solver nunca corta a superfície CONDER: ele só eleva a via quando crossfall, longitudinal e suporte total permanecem simultaneamente dentro da política;
- suporte total automático é limitado a 12 m;
- trechos incompatíveis com a capacidade estrutural ou com a continuidade de um junction entram em fallback explícito por OSM id, em vez de relaxar limites;
- corredores com `indoor=yes` continuam no OSM normalizado, mas não são derivados como pistas sobre o terreno;
- quando a borda baixa precisa ser elevada, é gerado suporte/contenção;
- junctions só conectam endpoints compatíveis em layer/bridge/tunnel/elevation mode;
- a superfície do junction é ajustada às mesmas bordas graduadas usadas pela ribbon da rua;
- limites de corte, aterro, inclinação e diferença para as bordas são validados automaticamente.

Essas regras produzem uma superfície caminhável coerente sem afirmar que o projeto contém cotas de engenharia civil.

## Passarela superior do Elevador

Corredores OSM com `highway=corridor` + `indoor=yes` continuam excluídos de `roads`, mas passam a ser preservados separadamente em `elevatedCorridors`.

No conjunto do Elevador Lacerda:

- `way/59409445` liga a torre à transição superior;
- `way/1455480196` continua até a Praça Tomé de Souza;
- `way/1455480198` preserva o trecho interno da torre.

Esses elementos são renderizados como um deck elevado caminhável, ancorado pela cota do ponto superior fora da estrutura. O caminho horizontal vem do OSM e não é drapeado pela escarpa CONDER. As caixas provisórias de passarela/acesso superior só permanecem como fallback quando os corredores persistentes não estão disponíveis.

## Máscaras do terreno

Máscaras são usadas somente quando uma estrutura ou deck precisa substituir visualmente/colisivamente o terreno existente.

O renderer não remove mais um triângulo-base inteiro de 2,5 m quando ele apenas encosta na máscara. A borda é subdividida adaptativamente até o limite definido em `terrainRenderMaskPolicy.maxBoundaryEdge`.

No estado atual:

- a precisão máxima da borda é 8 cm;
- footprints verificados de estruturas são recortados sem padding externo;
- junctions usam uma máscara ligeiramente interna ao deck para impedir que o recorte ultrapasse a superfície viária.

O terreno fora da região de máscara mantém sua malha original.

## Espaços públicos

Polígonos de espaço são triangulados e acompanhados sobre o terreno ativo.

`leisure=park` sem tag explícita de superfície rígida não recebe pavimentação inventada. Nesses casos o terreno oficial permanece visível e caminhável.

A Praça Tomé de Souza (`way/1263035782`) é uma exceção documentada: referências visuais mostram pavimentação pétrea contínua, então o manifesto aplica `stone` como override de apresentação/gameplay. A geometria e as tags OSM continuam intactas, e a superfície segue o terreno CONDER — o override não achata a praça.

## Edifícios

Marcos curados que já possuem footprint OSM versionado usam `footprintOsmId` como referência canônica. O runtime hidrata o polígono diretamente de `site-vectors.json`, recalcula centro/largura/profundidade e mantém altura/material/modelagem curada separadamente. O mesmo objeto não deve copiar os vértices OSM novamente em `site-data.json`.

O Palácio Thomé de Souza usa o OSM way `1317127245` como footprint horizontal canônico por correlação geométrica com o lote documentado pelo IPHAN: o polígono está integralmente dentro do TPTS de aproximadamente 46 × 50 m e mede aproximadamente 15,2 × 44,2 m, compatível com o corpo longitudinal central descrito como ~16 m de largura. O OSM não nomeia esse way no snapshot; essa identificação permanece explicitamente documentada como correlação IPHAN + geometria OSM, não como uma tag nominal do OSM.

Footprints OSM só são promovidos automaticamente para blockouts 3D quando:

- o polígono é válido;
- existe `height` explícito ou altura derivável de `building:levels`;
- o objeto não está na lista de marcos protegidos;
- não existe sobreposição indevida com um modelo/footprint curado;
- o relevo sob a fundação está dentro do limite permitido;
- o footprint não invade a superfície horizontal renderizada de ruas ou junctions, incluindo a margem conservadora configurada em `minAutoRoadClearance`.

Quando há conflito com uma via, o footprint OSM continua preservado como dado-fonte/guia, mas não vira automaticamente um volume 3D com colisão. Footprints em encosta forte ou em conflito viário permanecem pendentes para revisão/fundação/modelagem específica.

## Referência raster

O mapa raster OSM pode ser exibido sobre o terreno apenas para conferência visual de alinhamento.

Ele:

- não cria geometria 3D;
- não fornece colisão;
- não substitui ruas/edifícios;
- não é fonte de elevação;
- deve manter attribution visível.

## Fallback e refresh

O app ainda possui rotas same-origin e loaders live para OSM/CONDER. Eles são úteis para diagnóstico, refresh e recuperação quando um produto persistente não está disponível.

Quando o produto persistente válido existe:

- OSM versionado permanece autoritativo para o runtime;
- CONDER versionado permanece autoritativo para o terreno;
- live não é a fonte normal da cena;
- seed parcial não é a arquitetura principal.

## Comandos

Importar e derivar OSM:

```bash
npm run geospatial:import:osm
npm run geospatial:derive:vectors
```

Importar e derivar terreno:

```bash
npm run geospatial:import:conder
npm run geospatial:derive:terrain
```

Refresh por fonte:

```bash
npm run geospatial:refresh:vectors
npm run geospatial:refresh:terrain
```

Pipeline completo:

```bash
npm run geospatial:refresh
npm run geospatial:validate
```

Nenhum produto deve ser promovido a `geospatial-derived` apenas por existir no disco. O validador precisa confirmar CRS, perímetro, metadata, cobertura crítica, qualidade do terreno e contratos de gameplay.
