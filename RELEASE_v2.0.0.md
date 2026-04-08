# Release v2.0.0

## Highlights

- Importacao robusta de rodada real via `CSV/JSON`.
- Validacao de estrutura e probabilidades (14 jogos, soma de probabilidades).
- Persistencia da rodada customizada e reset para mock.
- Suite de testes automatizados para calculos criticos.
- Observabilidade leve com logs de suporte no navegador.

## Principais melhorias

- Dados:
  - Novo painel para importar rodada real (`.json` ou `.csv`).
  - Revalidacao completa do pipeline apos importacao.
- Qualidade:
  - Testes em `tests/critical-calculations.test.mjs`.
  - Funcoes de calculo extraidas para `lib/core.mjs`.
- UX:
  - Mensagens de erro mais claras.
  - Logs de runtime no app para diagnostico rapido.

## Como validar

1. Abrir o app no navegador.
2. Importar `data/round-example.json` e conferir sucesso.
3. Resetar para mock e importar `data/round-example.csv`.
4. Rodar testes:
   - `node --test tests/*.test.mjs`
