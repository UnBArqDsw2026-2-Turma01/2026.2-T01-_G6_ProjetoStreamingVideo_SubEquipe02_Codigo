# Projeto Streaming — Padrões Estruturais · SubEquipe_02

Implementação dos padrões GoF estruturais da Entrega 3 (Adapter, Proxy, Decorator e Facade) no contexto da disciplina de **Arquitetura e Desenho de Software (2026.2 - Turma 01 - G6)** da Universidade de Brasília (UnB).

---

## Como executar

```bash
npm install
npm run demo         # história completa
npm test             # testes
npm run coverage     # relatório de cobertura
npm run typecheck    # checagem estática de tipos (tsc)
```

---

## Estrutura do Projeto

| Pasta | Conteúdo |
| -- | -- |
| `src/dominio` | Classes compartilhadas pelas três frentes |
| `src/f1-recarga` | Adapter, Proxy e Decorator do preço |
| `src/f2-doacao` | Facade e Proxy do repasse |
| `src/f3-chat` | Decorator da mensagem destacada |
| `src/demo` | Demonstrações executáveis |
| `tests` | Testes, na mesma estrutura de `src` |

```plaintext
.
├── src/
│   ├── dominio/        # Classes compartilhadas pelas três frentes
│   ├── f1-recarga/     # Adapter, Proxy e Decorator do preço
│   ├── f2-doacao/      # Facade e Proxy do repasse
│   ├── f3-chat/        # Decorator da mensagem destacada
│   └── demo/           # Demonstrações executáveis (história completa)
├── tests/
│   ├── configuracao.test.ts # Teste de verificação do ambiente
│   ├── f1-recarga/          # Testes da frente de Recarga
│   ├── f2-doacao/           # Testes da frente de Doação
│   └── f3-chat/             # Testes da frente de Chat
├── jest.config.js      # Configuração do Jest com SWC
├── package.json        # Dependências e scripts npm
├── tsconfig.json       # Configurações do compilador TypeScript
└── README.md           # Documentação do repositório
```

---

## Frentes de Trabalho e Padrões GoF

| Frente | Etapa | Padrões GoF | Responsável(is) |
| -- | -- | -- | -- |
| **F1** | Recarga | **Adapter** (meios de pagamento distintos, fallback O07) · **Proxy** (confirmação idempotente e segura O11, O14) · **Decorator** (preço: desconto, imposto RN01) | Davi Severiano |
| **F2** | Doação e Repasse | **Facade** (coordena carteira, chat e repasse) · **Proxy** (impedir repasse duplicado O11) | Daniel Lira e Pedro Rodrigues |
| **F3** | Mensagem destacada | **Decorator** (camadas visuais: cor de faixa, fixação, emblema SC01, SC02) | Mateus Barreto |

---

## A História da Demonstração Integrada

A demonstração executável (`npm run demo`) integra a narrativa em 4 etapas no terminal:

1. **Recarga de moeda virtual (F1):** montagem de preço em camadas, cobrança via gateway com fallback e confirmação segura.
2. **Doação com mensagem (F2):** débito/crédito atômico e orquestração da doação via Facade.
3. **Mensagem destacada no chat (F3):** exibição decorada no chat (assíncrona, paralela ao passo 4).
4. **Repasse ao criador (F2):** acionado pela doação, independente da exibição no chat (coerente com a regra da modelagem da Entrega 2).

---

## Fluxo de trabalho

- **Branches:** uma branch por frente (`f1-recarga`, `f2-doacao` e `f3-chat`).
- **Integração:** via Pull Request na `main`, revisado por membros de outra frente.
- **Validação contínua:** executar `npm run typecheck` e `npm test` antes de cada commit.
- **Anonimização (Diretriz FE06):** nunca usar o nome real da plataforma de referência em código, arquivos ou commits.
  - Utilizar `<plataforma>` (e `<plataforma-B>`);
  - Utilizar **"moeda virtual"** (nunca o nome proprietário da moeda);
  - Utilizar **"mensagem paga destacada"** (nunca o nome proprietário do recurso).

---

## Documentação

Relatório da SubEquipe_02: *link a inserir*.

---

## 🚀 Tecnologias e Ambiente

- **Linguagem:** [TypeScript](https://www.typescriptlang.org/) (v7.0.2)
- **Runtime:** [Node.js](https://nodejs.org/) (>= 18)
- **Testes:** [Jest](https://jestjs.io/) com [@swc/jest](https://swc.rs/)
- **Execução Direta:** [tsx](https://github.com/privatenumber/tsx)

---

## 👥 Integrantes da SubEquipe 02

| Membro | GitHub | Matrícula |
| -- | -- | -- |
| Davi Severiano Freitas (líder) | [@Davi-UnB](https://github.com/Davi-UnB) | 241011018 |
| Daniel de Oliveira Lira | [@Daniellira540](https://github.com/Daniellira540) | 241025505 |
| Mateus Rodrigues Barreto | [@Mateus0xC](https://github.com/Mateus0xC) | 241011466 |
| Pedro Henrique Freire Rodrigues | [@Pedro-Henrique3](https://github.com/Pedro-Henrique3) | 231026545 |
