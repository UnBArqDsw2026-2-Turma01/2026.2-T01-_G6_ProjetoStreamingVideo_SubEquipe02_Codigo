# Projeto Streaming — Padrões Estruturais · SubEquipe_02

Implementação dos padrões GoF estruturais da Entrega 3 (Adapter, Proxy, Decorator e Facade) no contexto da disciplina de **Arquitetura e Desenho de Software (2026.2 - Turma 01 - G6)** da Universidade de Brasília (UnB).

Organizada como uma história de uso da plataforma:
1. **Recarga de moeda virtual** — F1 (Adapter, Proxy, Decorator)
2. **Doação com mensagem** — F2 (Facade, Proxy)
3. **Mensagem destacada no chat** — F3 (Decorator)
4. **Repasse ao criador** — F2

---

## Como executar

```bash
npm install
npm run demo         # história completa no terminal (processadores simulados, sem internet)
npm run demo:mp      # F1 com o Mercado Pago real, em conta de teste (ver abaixo)
npm run demo:stripe  # F1 com o Stripe real, em modo de teste (ver abaixo)
npm test             # testes
npm run coverage     # relatório de cobertura
npm run typecheck    # checagem estática de tipos (tsc)
```

> O `tsx` e o `@swc/jest` executam o código sem checar tipos. **Rode `npm run typecheck` antes de cada commit.**

---

## Estrutura do Projeto

| Pasta | Conteúdo | Quem mexe |
| -- | -- | -- |
| `src/dominio` | `Dinheiro`, `Usuario`, `Carteira`, `PerfilMonetizacao`, `Transacao`, `StatusTransacao` | Base — alterar só com acordo da equipe |
| `src/financeiro` | `ServicoFinanceiro`: única porta para movimentar saldos | Base |
| `src/compartilhado` | `RepositorioEmMemoria` e `GeradorId` | Base |
| `src/contratos` | `NotificadorChat`: contrato entre F2 e F3 | Base |
| `src/f1-recarga` | Catálogo de pacotes, Decorator do preço, Adapter dos gateways e Proxy da confirmação | F1 |
| `src/f2-doacao` | Facade e Proxy do repasse | F2 |
| `src/f3-chat` | Decorator da mensagem destacada | F3 |
| `src/demo` | Demonstrações executáveis (história completa) | Todos |
| `tests` | Testes, na mesma estrutura de `src` | Todos |

```plaintext
.
├── src/
│   ├── compartilhado/    # Repositório genérico em memória e gerador de IDs
│   ├── contratos/        # Interfaces e contratos entre frentes (ex: NotificadorChat)
│   ├── dominio/          # Classes e entidades compartilhadas (Dinheiro, Carteira, etc.)
│   ├── financeiro/       # Serviço financeiro (movimentação de saldos e transações)
│   ├── f1-recarga/       # Catálogo, Decorator do preço, Adapter e Proxy (Frente 1)
│   ├── f2-doacao/        # Facade e Proxy do repasse (Frente 2)
│   ├── f3-chat/          # Decorator da mensagem destacada (Frente 3)
│   └── demo/             # Demonstrações executáveis (história completa e F1 com processadores reais)
├── tests/
│   ├── configuracao.test.ts # Teste de verificação do ambiente
│   ├── compartilhado/       # Testes utilitários compartilhados
│   ├── contratos/           # Testes dos contratos provisórios
│   ├── dominio/             # Testes das entidades de domínio
│   ├── financeiro/          # Testes do serviço financeiro
│   ├── f1-recarga/          # Testes da frente de Recarga
│   ├── f2-doacao/           # Testes da frente de Doação
│   └── f3-chat/             # Testes da frente de Chat
├── jest.config.js        # Configuração do Jest com SWC
├── package.json          # Dependências e scripts npm
├── tsconfig.json         # Configurações do compilador TypeScript
└── README.md             # Documentação do repositório
```

---

## Como cada frente usa a base

**Importação** — sempre pelos arquivos `index.ts`:

```ts
import { Dinheiro, Usuario, Transacao } from "../dominio";
import { ServicoFinanceiro } from "../financeiro";
import { RepositorioEmMemoria, GeradorId } from "../compartilhado";
import type { NotificadorChat } from "../contratos";
```

- **F1 · Recarga** — cria a classe `Recarga` estendendo `Transacao`; ao confirmar o pagamento, chama `servicoFinanceiro.creditarMoedaVirtual(usuario, quantidade)`.
- **F2 · Doação e Repasse** — cria a classe `Doacao` estendendo `Transacao`; usa `servicoFinanceiro.transferirDoacao(...)` para debitar e repassar, e chama `notificadorChat.exibirMensagemDestacada(...)`. Enquanto a F3 não fica pronta, usa o `NotificadorChatProvisorio`.
- **F3 · Mensagem destacada** — implementa a interface `NotificadorChat`, aplicando o Decorator sobre a mensagem. Na integração, substitui o `NotificadorChatProvisorio`.
- **Regra do repasse** — o repasse é acionado pela doação e **não depende** da exibição no chat. Se o chat falhar, a doação continua válida.

---

## Regras da base

- **Dinheiro é sempre `Dinheiro`**, em centavos inteiros. Nunca usar `number` para valores monetários.
- **Saldos só mudam pelo `ServicoFinanceiro`** ou pelos métodos da `Carteira` — nunca diretamente.
- **Transações nascem PENDENTE** e só podem ser concluídas ou canceladas uma vez.
- **Alterações em `dominio`, `financeiro`, `compartilhado` ou `contratos`** afetam todas as frentes: combinar no grupo antes.

---

## Frentes de Trabalho e Padrões GoF

| Frente | Etapa | Padrões GoF | Responsável(is) |
| -- | -- | -- | -- |
| **F1** | Recarga | **Adapter** (meios de pagamento distintos, fallback O07) · **Proxy** (confirmação idempotente e segura O11, O14) · **Decorator** (preço: desconto, taxa fixa, imposto RN01) | Davi Severiano |
| **F2** | Doação e Repasse | **Facade** (coordena carteira, chat e repasse) · **Proxy** (impedir repasse duplicado O11) | Daniel Lira e Pedro Rodrigues |
| **F3** | Mensagem destacada | **Decorator** (camadas visuais: cor de faixa, fixação, emblema SC01, SC02) | Mateus Barreto |

---

## F1 · Recarga de moeda virtual

| Pasta | Padrão | Conteúdo |
| -- | -- | -- |
| `f1-recarga/catalogo.ts` | — | Pacotes e promoção vigente da plataforma |
| `f1-recarga/preco` | **Decorator** | `PrecoPacote` + `ComDesconto` → `ComTaxaFixa` → `ComImposto` |
| `f1-recarga/pagamento` | **Adapter** | `GatewayPagamento` com `AdaptadorMercadoPago`, `AdaptadorStripe` e `AdaptadorProcessadorSimulado` |
| `f1-recarga/confirmacao` | **Proxy** | `ProxyConfirmacaoSegura` (assinatura O14, duplicidade O11) diante do `ServicoConfirmacao` |

- **Catálogo único:** os pacotes (20 de moeda virtual por R$ 1, com bônus progressivo de 0% a 40%) e a promoção (29% de desconto, 5% de imposto) pertencem ao sistema e valem para **todos** os meios de pagamento. Os gateways recebem só o valor final; nunca conhecem pacotes nem moeda virtual.
- **Só reais:** toda a recarga opera em BRL; não há conversão de moeda.
- **Mercado Pago (Checkout Pro):** o `AdaptadorMercadoPago` adapta direto o SDK oficial (`mercadopago`). O `idCheckout` é o id da preferência; a consulta encontra o pagamento pela `external_reference` (id da recarga).
- **Stripe (Checkout Session):** o `AdaptadorStripe` adapta direto o SDK oficial (`stripe`). O `idCheckout` é o id da sessão (`cs_...`), e a recarga vai como `client_reference_id`. Sessão paga é APROVADO, aberta é PENDENTE e expirada é RECUSADO.

### Rodando com o Mercado Pago (conta de teste)

1. No [painel de desenvolvedores](https://www.mercadopago.com.br/developers/panel/test-users), crie dois usuários de teste: um **vendedor** e um **comprador**.
2. Entre com o vendedor de teste, crie uma aplicação e copie o *access token* de produção **dele**.
3. Crie um `.env` na raiz (ele é ignorado pelo git):

   ```bash
   MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...   # token do vendedor de TESTE
   MERCADO_PAGO_WEBHOOK_SECRET=um-segredo-local
   ```

4. Rode `npm run demo:mp`, abra o link em aba anônima e pague logado com o **comprador de teste**. O demo detecta a aprovação, passa o aviso pelo Proxy e credita as moedas.

### Rodando com o Stripe (modo de teste)

1. No [dashboard do Stripe](https://dashboard.stripe.com/test/apikeys), em modo de teste, copie a **chave secreta** (`sk_test_...`).
2. Adicione ao `.env`:

   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=um-segredo-local
   ```

3. Rode `npm run demo:stripe`, abra o link e pague com o cartão `4242 4242 4242 4242`, qualquer validade futura e qualquer CVC. Depois do pagamento, o Stripe redireciona para `localhost:3000`; a página não existir é esperado, porque o demo confirma o pagamento por consulta.

> Os dois demos (`src/demo/f1-pagamento-real.ts`) recusam credenciais de produção, que gerariam cobrança de verdade (para forçar: `PERMITIR_PRODUCAO=1`). O webhook ainda é simulado localmente depois que a aprovação é detectada por consulta.

---

## A História da Demonstração Integrada

A demonstração executável (`npm run demo`) integra a narrativa em 4 etapas no terminal:

1. **Recarga de moeda virtual (F1):** montagem de preço em camadas, cobrança via gateway com fallback e confirmação segura.
2. **Doação com mensagem (F2):** débito/crédito atômico e orquestração da doação via Facade.
3. **Mensagem destacada no chat (F3):** exibição decorada no chat (assíncrona, paralela ao passo 4).
4. **Repasse ao criador (F2):** acionado pela doação, independente da exibição no chat (coerente com a regra da modelagem da Entrega 2).

---

## Fluxo de trabalho

- **Branches:** uma branch por frente (`f1-recarga`, `f2-doacao` e `f3-chat`), criadas a partir da `main`.
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
- **Pagamentos (F1):** SDKs oficiais do [Mercado Pago](https://github.com/mercadopago/sdk-nodejs) (`mercadopago` v3) e do [Stripe](https://github.com/stripe/stripe-node) (`stripe` v23)

---

## 👥 Integrantes da SubEquipe 02

| Membro | GitHub | Matrícula |
| -- | -- | -- |
| Davi Severiano Freitas (líder) | [@Davi-UnB](https://github.com/Davi-UnB) | 241011018 |
| Daniel de Oliveira Lira | [@Daniellira540](https://github.com/Daniellira540) | 241025505 |
| Mateus Rodrigues Barreto | [@Mateus0xC](https://github.com/Mateus0xC) | 241011466 |
| Pedro Henrique Freire Rodrigues | [@Pedro-Henrique3](https://github.com/Pedro-Henrique3) | 231026545 |
