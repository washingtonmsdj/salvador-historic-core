# Roadmap

## Fundação concluída

- [x] Registrar referências geográficas reais iniciais do perímetro
- [x] Centralizar dados métricos, fontes e flags `estimated` em `site-data.json`
- [x] Separar módulos Babylon.js de terreno, vias, edifícios, Elevador, câmeras, jogador e debug
- [x] Montar a cena 3D na rota principal e remover o placeholder do template
- [x] Implementar câmera aérea, câmera de rua, WASD, gravidade, colisões e debug
- [x] Renderizar contenções e guarda-corpos já descritos nos dados
- [x] Renderizar praças a partir dos polígonos armazenados, sem bounding boxes
- [x] Substituir a rampa 1D por escarpa 2D variável ao longo de X/Z
- [x] Fazer as vias acompanharem continuamente a superfície do terreno
- [x] Preparar importador das curvas de nível oficiais da CONDER

## Próxima etapa de fidelidade

- [ ] Substituir blockouts estimados por footprints verificados de OSM/GeoJSON
  - [x] Mercado Modelo — footprint OSM way 59392558
  - [x] Palácio Rio Branco — footprint OSM way 402383814
  - [ ] Palácio Thomé de Souza e frentes restantes da Praça/Rua Chile
- [ ] Importar as curvas CONDER do recorte e gerar superfície TIN/height field verificável
- [ ] Avaliar MDT/LiDAR municipal como fonte altimétrica preferencial quando houver endpoint/arquivo estável
- [ ] Substituir os blockouts retangulares de edificações por footprints poligonais verificados
- [x] Corrigir enquadramento, contraste e elementos provisórios que tornavam a cena ilegível
- [x] Centralizar o perímetro no Elevador e fechar a maquete com base/paredes laterais
- [x] Garantir superfície contínua sempre visível com acabamento rochoso apenas na escarpa
- [x] Adicionar validação automática dos limites e da centralização do terreno
- [x] Usar footprint OSM do Elevador como torre principal e recorte do terreno
- [x] Impedir vias de atravessarem Elevador e Mercado Modelo por validação geométrica
- [x] Alinhar blockouts da Rua Chile a um único eixo OSM verificado
- [x] Remover placeholders urbanos sem identidade/alinhamento verificável
- [x] Preparar importador OSM do recorte com fallback de endpoint e conversão para metros locais
- [ ] Rodar importador OSM e promover traçado verificável da Ladeira da Montanha antes de recolocá-la na cena
- [x] Nivelar o envelope TPTS 46 x 50 m como patamar coerente com a Praça no blockout
- [ ] Validar orientação, escala e alinhamento visual dos marcos principais contra referências verificadas
- [ ] Restaurar typecheck/lint/build em CI quando o runner hospedado estiver disponível
- [ ] Validar desktop, celular, desempenho e acessibilidade dos controles
- [ ] Preparar substituição progressiva dos blockouts por modelos GLB


## Base geoespacial real — prioridade atual

- [x] Definir manifesto GIS com CRS EPSG:32724 e Elevador Lacerda como origem local
- [x] Separar pipeline em raw → normalized → derived
- [x] Preservar respostas originais de OSM e CONDER para auditoria
- [x] Converter OSM WGS84 para UTM 24S/local metres com transformação determinística
- [x] Preparar importação oficial de curvas CONDER REL_Curva_Nivel_L
- [x] Expor no runtime quando terreno/vetores ainda estão em fallback
- [x] Ativar seed OSM versionada parcial para Rua Chile, Praça Tomé e Elevador
- [x] Carregar OSM ao vivo no Preview com fallback para a seed versionada
- [ ] Executar importação OSM completa do recorte e revisar features
- [ ] Executar importação CONDER do recorte
- [x] Implementar gerador determinístico de heightfield derivado das curvas CONDER
- [ ] Executar a derivação com o recorte CONDER real ou substituir pelo MDT municipal quando disponível
- [x] Preparar o runtime para preferir a superfície geoespacial derivada validada
- [ ] Ativar geospatial-derived após importar/validar o recorte real
- [x] Implementar derivação OSM de ruas, praças e footprints recortados ao perímetro
- [x] Preparar runtime para preferir ruas e espaços OSM derivados e validados
- [ ] Executar a importação OSM real e ativar site-vectors.json
- [x] Preparar promoção conservadora de footprints OSM com altura explícita/níveis e terreno GIS
- [x] Remover placeholders genéricos da Rua Chile quando os blockouts OSM estiverem ativos
- [ ] Executar OSM + terreno reais e revisar visualmente cada volume promovido
- [ ] Modelar fundações específicas para footprints em encosta forte
- [ ] Integrar ortofoto apenas como camada de conferência/debug, sem acoplar gameplay a tiles externos
- [ ] Remover o terreno procedural da experiência normal quando a base real estiver validada

O terreno procedural existente passa a ser somente fallback de desenvolvimento. Nenhum ajuste manual
de perfis deve ser tratado como melhoria de fidelidade geográfica.
