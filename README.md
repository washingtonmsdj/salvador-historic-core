# Salvador Historic Core

Crie um protótipo web 3D jogável da região central histórica de Salvador, Bahia, usando React + TypeScript + Babylon.js.

OBJETIVO DA PRIMEIRA VERSÃO:

Criar apenas o blockout arquitetônico e topográfico do perímetro entre:

- Praça Tomé de Souza;

- Rua Chile;

- Elevador Lacerda;

- Prefeitura/Palácio Thomé de Souza;

- Palácio Rio Branco;

- encosta entre Cidade Alta e Cidade Baixa;

- estrada ao lado e abaixo do elevador;

- acesso inferior;

- Mercado Modelo.

Não tente modelar toda Salvador agora.

SISTEMA DE COORDENADAS:

- trabalhar exclusivamente em metros;

- eixo Y = altura;

- eixo X = leste/oeste;

- eixo Z = norte/sul;

- usar o Elevador Lacerda como origem local;

- manter orientação geográfica consistente;

- não usar longitude/latitude diretamente para posicionar objetos;

- converter dados geográficos para coordenadas locais em metros.

REGRA DE FIDELIDADE:

- não inventar ruas, praças ou prédios;

- utilizar footprints, alinhamentos e vias reais fornecidos em GeoJSON, OSM ou arquivos de referência;

- quando uma medida real não estiver disponível, criar o objeto como PROVISÓRIO e marcar a propriedade como ESTIMATED;

- não apresentar medidas estimadas como oficiais;

- todas as dimensões devem ficar centralizadas em um arquivo de dados, por exemplo site-data.json;

- nenhum edifício deve receber dimensões aleatórias espalhadas pelo código.

ESTRUTURA DO TERRENO:

- criar um terreno contínuo entre Cidade Alta e Cidade Baixa;

- não criar duas plataformas planas desconectadas;

- representar a ribanceira/encosta começando ao final da Praça Tomé de Souza;

- incluir desnível, contenções, guarda-corpos, rampas, ruas e acessos;

- a estrada deve passar corretamente entre os níveis, acompanhando o terreno;

- deixar o terreno preparado para receber posteriormente dados reais de elevação.

EDIFÍCIOS EM BLOCKOUT:

Criar volumes simples, em cubos e prismas, separados por objeto:

- torre superior do Elevador Lacerda;

- passarela superior;

- torre inferior;

- acesso superior;

- acesso inferior;

- Prefeitura/Palácio Thomé de Souza;

- Palácio Rio Branco;

- edifício do lado oposto da Prefeitura;

- prédios vizinhos da Praça Tomé de Souza;

- edifícios alinhados na Rua Chile;

- Mercado Modelo como volume provisório na Cidade Baixa.

Cada volume deve possuir:

- id;

- nome;

- tipo;

- posição em metros;

- rotação;

- largura;

- profundidade;

- altura;

- fonte da medida;

- campo estimated true/false.

ELEVADOR:

- representar a torre vertical, passarela e os dois acessos;

- marcar claramente a entrada superior e a saída inferior;

- manter o elevador alinhado com o terreno real;

- permitir substituir o blockout futuramente por um arquivo elevador_lacerda.glb;

- criar pontos chamados upperEntrance, lowerEntrance e elevatorPath;

- não transformar o Elevador em um único cubo.

CÂMERAS:

Criar duas câmeras:

1. câmera aérea mostrando Cidade Alta, encosta, Elevador e Cidade Baixa;

2. câmera ao nível da rua na Praça Tomé de Souza;

Adicionar botões para alternar entre elas.

VISUAL:

- usar cores simples por categoria;

- terreno verde/cinza;

- ruas em cinza;

- praças em tom claro;

- prédios em bege;

- Elevador em cor destacada;

- mostrar nomes e eixos no modo debug;

- não gastar tempo com texturas, janelas ou acabamento nesta versão.

CONTROLES:

- câmera livre;

- modo primeira pessoa simples;

- movimentação WASD;

- colisões básicas no terreno e nos edifícios;

- botão para ativar/desativar modo debug;

- botão para voltar à câmera aérea.

PERFORMANCE:

- não carregar toda a cidade;

- separar a região em blocos/tile;

- usar instancing para prédios repetidos;

- manter cada edifício como objeto substituível;

- preparar carregamento posterior de arquivos GLB;

- evitar uma única malha gigante.

ORGANIZAÇÃO:

Criar uma estrutura de dados separada da renderização.

Criar componentes ou módulos separados para:

- terrain;

- roads;

- buildings;

- elevator;

- cameras;

- player;

- debug overlay.

ENTREGA DA PRIMEIRA VERSÃO:

- mostrar a cena funcionando no navegador;

- mostrar claramente Cidade Alta e Cidade Baixa;

- mostrar o Elevador como conexão vertical;

- mostrar a Praça Tomé de Souza;

- mostrar ruas e prédios blocados;

- incluir um arquivo README explicando onde inserir GeoJSON, dados de elevação e modelos GLB;

- não adicionar detalhes decorativos ainda.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fc4a8d69-de5d-46d3-90c1-03d72c8852c8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
