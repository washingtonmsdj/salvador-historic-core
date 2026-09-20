# Roadmap

## Fundação concluída

- [x] Registrar referências geográficas reais iniciais do perímetro
- [x] Centralizar dados métricos, fontes e flags `estimated` em `site-data.json`
- [x] Separar módulos Babylon.js de terreno, vias, edifícios, Elevador, câmeras, jogador e debug
- [x] Montar a cena 3D na rota principal e remover o placeholder do template
- [x] Implementar câmera aérea, câmera de rua, WASD, gravidade, colisões e debug
- [x] Renderizar contenções e guarda-corpos já descritos nos dados\n- [x] Renderizar praças a partir dos polígonos armazenados, sem bounding boxes

## Próxima etapa de fidelidade

- [ ] Substituir blockouts estimados por footprints verificados de OSM/GeoJSON
- [ ] Trocar o perfil procedural da encosta por DEM/altimetria verificável
- [ ] Substituir os blockouts retangulares de edificações por footprints poligonais verificados
- [ ] Validar orientação, escala e alinhamento visual dos marcos principais
- [ ] Adicionar testes de integridade dos dados e build em CI
- [ ] Validar desktop, celular, desempenho e acessibilidade dos controles
- [ ] Preparar substituição progressiva dos blockouts por modelos GLB
