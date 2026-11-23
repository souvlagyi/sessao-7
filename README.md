# Sessão 7

MVP de um SaaS para cineclubes, escolas e centros culturais divulgarem sessões e controlarem a lotação. O público reserva lugares e recebe um código. A equipe publica sessões, consulta a lista, confirma presenças e cancela reservas.

**Integrantes:** Guilherme Nomoto Matuhashi e José Octavio Zansavio Pereira.

## Como rodar

1. Use o [Node.js 24 LTS](https://nodejs.org/pt-br/download), ou Node.js 22.13+ com `node:sqlite` disponível.
2. Extraia o ZIP ou clone o repositório. No Windows, dê dois cliques em `Iniciar.bat`. Se preferir o terminal, execute `node server.mjs` na pasta do projeto.
3. Abra `http://127.0.0.1:3217` no navegador e mantenha o terminal aberto durante o uso. Não é necessário instalar pacotes nem configurar credenciais.

O primeiro início cria `dados/sessao7.sqlite`, com três sessões futuras e duas reservas fictícias para o filme em destaque. Para ensaios independentes, indique um novo arquivo de banco usando a variável de ambiente `SESSAO7_BANCO` ao rodar o servidor. Para usar outra porta, informe `PORT`.

## Fluxo do MVP

1. Abra **Em cartaz**. A sessão de **Tears of Steel** começa com duas vagas livres em um banco recém-criado.
2. Em **Reservar lugar**, informe um nome de teste. Tente reservar três lugares para ver a mensagem de lotação. Em seguida, reserve dois e anote o código.
3. Em **Área do organizador**, confira a ocupação e localize o registro pelo código. Cancelar a reserva do ensaio libera os dois lugares. Você também pode confirmar presença em uma reserva ativa.
4. Em **Nova sessão**, escolha um filme e informe data futura, sala e capacidade. A nova sessão entra na programação.

## Tecnologias e arquitetura

| Camada | Tecnologias | Responsabilidade |
| --- | --- | --- |
| Interface | HTML, CSS e JavaScript | Catálogo responsivo, formulários, mensagens e painel |
| Aplicação | Node.js e API HTTP com JSON | Rotas, validação, disponibilidade e mudanças de status |
| Dados | SQLite (`node:sqlite`) | Sessões, reservas, relacionamento por chave estrangeira e armazenamento em disco |

```text
Navegador (public/)  <── HTTP / JSON ──>  Node.js (server.mjs)
                                             │
                                 regras e consultas (cinema.mjs)
                                             │
                                      SQLite em disco
```

- `GET /api/catalogo` lista filmes e sessões com vagas. `POST /api/sessoes` publica uma sessão.
- `GET /api/sessoes/:id/reservas` lista as reservas. `POST` na mesma rota cria uma reserva e devolve o código.
- `PATCH /api/reservas/:codigo` confirma presença ou cancela. Reservas canceladas liberam vagas. Presenças confirmadas continuam ocupando lugares.
- A reserva usa uma instrução SQL parametrizada que testa a capacidade no próprio `INSERT … SELECT`. Assim, duas requisições concorrentes disputam as mesmas vagas no banco.

## Modelo de SaaS

Uma conta por organização, com programação pública e painel protegido para a equipe. A proposta inicial é uma licença de **R$ 39 por mês por organização**, com um período de teste. A organização contrataria o serviço. O público continuaria reservando sem cobrança no plano proposto. O valor é uma hipótese para validar com potenciais clientes.

O MVP atende uma organização local. Para oferecer o serviço a clientes, seriam necessários login e perfis, isolamento de dados por organização, hospedagem HTTPS, backups e gestão de assinaturas. Use dados fictícios no ambiente de demonstração.

## IA e créditos

O Codex (OpenAI) ajudou a planejar e implementar o MVP, preparar a documentação e verificar o fluxo. Um exemplo é a implementação e o teste da consulta SQL que impede reservas acima da lotação. As imagens do catálogo são material oficial da Blender Foundation e estão creditadas em [Créditos das imagens](public/creditos.html).

Referências técnicas: [Node.js SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) e [SQLite — transações](https://www.sqlite.org/lang_transaction.html).
