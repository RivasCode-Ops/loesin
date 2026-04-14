# Loteria Esportiva Inteligente (LOESIN)

Aplicacao web standalone para analise de jogos da Loteca, com sugestoes de secas, composicoes de duplos/triplos, cobertura e chance estimada de acerto.

Repositorio oficial: [https://github.com/RivasCode-Ops/loesin](https://github.com/RivasCode-Ops/loesin)

## Funcionalidades

- Sugestoes de apostas secas (top 8 por margem de confianca).
- Calculo de composicao ideal com 3 perfis:
  - Conservadora
  - Equilibrada (recomendada)
  - Agressiva
- Percentual de cobertura do volante e total de combinacoes.
- Chance estimada de 14 acertos (formato `1 em N` e percentual).
- Geracao de volante final exportavel em `.txt`.
- Exportacao visual do volante em `.png` (via Canvas API, sem libs externas).
- Edicao manual de palpites por jogo com recalculo em tempo real.
- Persistencia local (`localStorage`) da composicao e volante manual.
- Alerta visual quando composicao manual sai da faixa recomendada.
- Comparador de estrategias (conservadora, equilibrada, agressiva e manual).
- Simulador Monte Carlo (10.000 rodadas) com IC 95% para calibrar chance de 14 acertos.
- Presets de risco (baixo/medio/alto) para ajustar composicao automaticamente.
- Historico local dos ultimos 5 volantes exportados com reaplicacao em 1 clique.
- Exportar/importar volante em JSON com validacao e reaplicacao automatica.
- Comparador A/B de dois volantes JSON com destaque da melhor relacao custo/chance.
- Otimizador por orcamento para sugerir automaticamente a melhor composicao no teto definido.
- Importacao robusta de rodada em CSV/JSON (v2.0) com validacao.
- Logs de suporte no navegador para ajudar diagnostico de erros.

## Estrutura

```text
loesin/
├── index.html
├── style.css
├── script.js
├── README.md
├── CHANGELOG.md
├── RELEASE_v2.0.0.md
├── assets/
├── data/
│   ├── games.json
│   ├── round-example.csv
│   └── round-example.json
├── lib/
├── scripts/
├── tests/
└── .github/
    └── workflows/
```

## Como usar

1. Abra o `index.html` no navegador (ou rode com um servidor local simples).
2. Veja os 14 jogos mock da rodada e as probabilidades de Casa/Empate/Fora.
3. (Opcional) Importe uma rodada real em `CSV` ou `JSON` no painel "Dados da Rodada (v2.0)".
4. Escolha uma composicao (conservadora, equilibrada ou agressiva).
5. Marque `Montar minha aposta ideal`.
6. Clique em `Gerar Volante` para visualizar e baixar o arquivo do volante.

## Formato de importacao de rodada

JSON (array com 14 jogos):

```json
[
  { "home": "Flamengo", "away": "Vasco", "probabilities": { "H": 0.65, "D": 0.10, "A": 0.25 } }
]
```

CSV (cabecalho obrigatorio):

```text
home,away,H,D,A
Flamengo,Vasco,0.65,0.10,0.25
```

Exemplos prontos no repositorio:

- `data/round-example.json`
- `data/round-example.csv`

## Testes automatizados

Rodar suite minima de calculos criticos:

```bash
node --test tests/*.test.mjs
```

## Releases e versionamento

- Changelog em `CHANGELOG.md`.
- Tag recomendada para a entrega atual: `v2.0.0`.
- Notas da release prontas em `RELEASE_v2.0.0.md`.

### Publicar Release na UI do GitHub

1. Abra o repositorio no GitHub e acesse `Releases`.
2. Clique em `Draft a new release`.
3. Selecione a tag `v2.0.0`.
4. Copie o conteudo de `RELEASE_v2.0.0.md` para a descricao.
5. Clique em `Publish release`.

## Checklist final de entrega

- [x] Funcionalidades implementadas e publicadas em `main`.
- [x] Testes criticos automatizados (`node --test`).
- [x] CI configurado em `.github/workflows/ci-tests.yml`.
- [x] Tag de versao publicada (`v2.0.0`).
- [x] Release publicada na UI do GitHub (`v2.0.0`).

### Verificacao rapida pre-release (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1
```

## Logica tecnica aplicada

- Dados mock com 14 jogos reais em `data/games.json`.
- Ranking de confianca por jogo:
  - `margem = maior probabilidade - segunda maior probabilidade`
- Secas: top 8 jogos por maior margem de confianca.
- Duplos/triplos aplicados primeiro nos jogos de menor confianca.
- Otimizacao simples por relacao `cobertura/custo` dentro dos limites:
  - Duplos: 2 a 6
  - Triplos: 0 a 2
- Custo base:
  - `combinacoes = 2^duplos * 3^triplos`
  - `custo = combinacoes * R$ 1,00`
- Chance estimada:
  - Produto das probabilidades cobertas em cada jogo.

## Print da interface

![Preview da interface LOESIN](assets/screenshot-interface.svg)

Ao abrir o app, a interface apresenta:

- Header com descricao da ferramenta.
- 14 cards de jogos com probabilidades.
- Bloco de sugestoes de secas.
- Composicoes sugeridas com destaque para recomendada.
- Resultado da combinacao com cobertura, chance e custo.
- CTA para gerar e exportar volante.

## Deploy (GitHub Pages)

O repositorio foi configurado com workflow de deploy automatico em `.github/workflows/deploy-pages.yml`.

URL esperada do app publicado:

- `https://rivascode-ops.github.io/loesin/`

Se a pagina ainda nao abrir:

1. Acesse `Settings > Pages` no repositorio.
2. Em `Build and deployment`, selecione `GitHub Actions`.
3. Aguarde o workflow `Deploy static site to Pages` concluir.

## Copy da entrega solicitada

> [HEADER]
> Loteria Esportiva Inteligente
> Analise os jogos com sugestoes de apostas secas, distribuicao ideal de duplos e triplos, percentual de cobertura e estimativa de chance de acerto.
>
> [JOGOS - 14 cards]
> Jogo 1: Flamengo x Vasco [Casa: 65% | Fora: 25% | Empate: 10%]
> [ ] Casa [ ] Empate [ ] Fora
>
> [SUGESTOES]
> Sugestoes de secas: Flamengo, Corinthians, Sao Paulo, Palmeiras, Atletico-MG, Gremio
> Composicao ideal:
> Conservadora: 3 duplos, 0 triplos (R$ 8)
> Equilibrada: 4 duplos, 1 triplo (R$ 48) ★ RECOMENDADO
> Agressiva: 5 duplos, 2 triplos (R$ 432)
>
> [RESULTADO DA COMBINACAO]
> Cobertura estimada: 28,6%
> Chance de 14 acertos: 1 em 124.000
> Custo da aposta: R$ 48,00
>
> [CTA PRINCIPAL]
> [ ] Montar minha aposta ideal -> [GERAR VOLANTE]
