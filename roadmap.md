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
- [ ] Validar orientação, escala e alinhamento visual dos marcos principais contra referências verificadas
- [ ] Restaurar typecheck/lint/build em CI quando o runner hospedado estiver disponível
- [ ] Validar desktop, celular, desempenho e acessibilidade dos controles
- [ ] Preparar substituição progressiva dos blockouts por modelos GLB
