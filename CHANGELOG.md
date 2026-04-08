# Changelog

## v2.0.0

- Importacao robusta de rodada em `JSON` e `CSV` (14 jogos).
- Validacao de estrutura/probabilidades por jogo.
- Persistencia da rodada importada em `localStorage` com opcao de reset para mock.
- Observabilidade leve com logs de erros de runtime e promises rejeitadas.
- Suite minima de testes automatizados para calculos criticos (`node --test`).
- Melhorias de UX para mensagens de import/export e erros.

## v1.x

- Evolucao incremental da v1.0 ate v1.9 com:
  - secas, composicoes e cobertura;
  - chance estimada + Monte Carlo;
  - exportacoes TXT/PNG/JSON;
  - comparador A/B JSON;
  - historico local;
  - otimizador por orcamento.
