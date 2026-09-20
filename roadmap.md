# Roadmap

## Fundação concluída

- [x] Registrar referências geográficas reais iniciais do perímetro
- [x] Centralizar dados métricos, fontes e flags `estimated` em `site-data.json`
- [x] Separar módulos Babylon.js de terreno, vias, edifícios, Elevador, câmeras, jogador e debug
- [x] Montar a cena 3D na rota principal e remover o placeholder do template
- [x] Implementar câmera aérea, câmera de rua, WASD, gravidade, colisões e debug
- [x] Renderizar contenções e guarda-corpos já descritos nos dados\n- [x] Renderizar praças a partir dos polígonos armazenados, sem bounding boxes\n- [x] Substituir a rampa 1D por escarpa 2D variável ao longo de X/Z\n- [x] Fazer as vias acompanharem continuamente a superfície do terreno\n- [x] Preparar importador das curvas de nível oficiais da CONDER

## Próxima etapa de fidelidade

- [ ] Substituir blockouts estimados por footprints verificados de OSM/GeoJSON
- [ ] Importar as curvas CONDER do recorte e gerar superfície TIN/height field verificável\n- [ ] Avaliar MDT/LiDAR municipal como fonte altimétrica preferencial quando houver endpoint/arquivo estável
- [ ] Substituir os blockouts retangulares de edificações por footprints poligonais verificados
- [ ] Validar orientação, escala e alinhamento visual dos marcos principais
- [ ] Adicionar testes de integridade dos dados e build em CI
- [ ] Validar desktop, celular, desempenho e acessibilidade dos controles
- [ ] Preparar substituição progressiva dos blockouts por modelos GLB
