# Roadmap

## Fundação concluída

- [x] Definir origem local no Elevador Lacerda e CRS EPSG:32724
- [x] Separar pipeline geoespacial em raw → normalized → derived
- [x] Preservar dados originais de OSM e CONDER para auditoria
- [x] Implementar transformação WGS84 ↔ UTM 24S ↔ coordenadas locais
- [x] Importar e versionar curvas oficiais CONDER do recorte
- [x] Derivar terreno persistente de 2,5 m e ativá-lo no runtime
- [x] Importar e versionar snapshot OSM completo do perímetro
- [x] Validar cobertura das quatro vias críticas
- [x] Ativar vetores persistentes `geospatial-derived` sem fallback
- [x] Renderizar vias sobre o terreno ativo com largura/provenance preservadas
- [x] Classificar materiais viários a partir das tags OSM
- [x] Limitar crossfall e criar suporte somente quando necessário
- [x] Limitar perfil longitudinal caminhável a 14% sem cortar o terreno oficial
- [x] Auditar capacidade combinada de crossfall, longitudinal e suporte
- [x] Excluir `indoor=yes` da derivação de pistas de terreno sem perder a feature normalizada
- [x] Derivar junctions apenas de endpoints compatíveis
- [x] Ajustar junctions às bordas graduadas das vias
- [x] Sincronizar spawn/player com superfícies caminháveis reais
- [x] Evitar pavimentação inventada em parques sem surface explícita
- [x] Promover footprints de edifícios somente com política conservadora
- [x] Alinhar blockouts curados ao terreno ativo
- [x] Recortar terreno sob o footprint verificado do Elevador
- [x] Refinar bordas de máscaras do terreno adaptativamente
- [x] Criar CI `Quality` com validações geoespaciais, gameplay e build
- [x] Remover workflows temporários de probe após materializar os dados

## Fidelidade atual

- [x] Rua Chile proveniente do dataset OSM persistente
- [x] Ladeira da Montanha proveniente do dataset OSM persistente
- [x] Rua da Conceição da Praia proveniente do dataset OSM persistente
- [x] Avenida Lafayete Coutinho proveniente do dataset OSM persistente
- [x] Terreno normal do runtime proveniente do produto CONDER derivado
- [x] Terrain procedural mantido apenas como fallback
- [x] Junctions com limites automáticos de slope/cut/fill/road-edge delta
- [x] Estradas auditadas contra o terreno ativo em toda a coleção derivada

- [x] Palácio Thomé de Souza: substituir retângulo manual pelo footprint OSM correlacionado ao lote IPHAN e proteger a correlação em CI.
- [x] Elevador Lacerda: preservar corredores indoor OSM separadamente das ruas e renderizar a passarela superior como deck elevado caminhável.
- [x] Elevador Lacerda: eliminar cópias runtime do footprint da torre, usar `footprintOsmId=59224731` e manter somente um snapshot explicitamente validado para o fallback procedural.
- [x] Integrar `layout:validate` ao CI para impedir regressões entre constraints legadas e a base GIS canônica.

## Próximas prioridades

- [ ] Fazer revisão visual sistemática contra ortofoto/mapa e referências de rua
- [ ] Modelar especificamente as vias listadas em `longitudinalProfileFallbackOsmIds` para reduzir/remover exceções sem aumentar tolerâncias
- [ ] Corrigir individualmente qualquer trecho em que a geometria fonte esteja incompleta ou classificada incorretamente
- [ ] Modelar fundações específicas para footprints em encostas fortes
- [ ] Substituir blockouts importantes por footprints/modelos arquitetônicos verificados
- [ ] Refinar Palácio Thomé de Souza, frentes da Praça/Rua Chile e acessos do Elevador
- [ ] Avaliar MDT/LiDAR municipal como futura fonte altimétrica preferencial
- [ ] Validar desempenho das máscaras adaptativas e malhas viárias em desktop/mobile
- [ ] Validar acessibilidade e controles da experiência jogável
- [ ] Preparar substituição progressiva de blockouts por GLB
- [ ] Revisar iluminação, materiais e LOD sem alterar geometria geoespacial
- [ ] Executar uma auditoria final de documentação antes do merge de cada grande fase

## Regra permanente

A fidelidade deve evoluir pela melhoria das fontes, transformações e modelagem verificável — não por coordenadas manuais inseridas para fazer a cena “parecer certa”.

O terreno procedural e qualquer placeholder estimado permanecem claramente identificados e não podem ser apresentados como dados oficiais.
