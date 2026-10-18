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
npm run web          # front-end da história completa em http://localhost:3000
npm run demo:f2      # F2 sozinha no terminal
npm run demo:f3      # F3 sozinha no terminal
npm run demo:mp      # F1 com o Mercado Pago real, em conta de teste (ver abaixo)
npm run demo:stripe  # F1 com o Stripe real, em modo de teste (ver abaixo)
npm run demo:interativo  # F1 no terminal: você é o espectador e escolhe pacote e meio de pagamento
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
| **F1** | Recarga | **Adapter** (meios de pagamento distintos; meio escolhido pelo espectador, com alternativas se indisponível O07) · **Proxy** (confirmação idempotente e segura O11, O14) · **Decorator** (preço: desconto, taxa fixa, imposto RN01) | Davi Severiano |
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
- **Escolha do meio de pagamento:** o modal lista os meios com `consultarMeiosPagamento()` e o espectador escolhe um em `recarregar(..., gateway)`. Se o meio escolhido estiver indisponível, a recarga é cancelada e o sistema lança `ErroMeioPagamentoIndisponivel` com as alternativas, sem trocar de processador por conta própria (O07). Sem escolha, os gateways são tentados em ordem.
- **Mercado Pago (Checkout Pro):** o `AdaptadorMercadoPago` adapta direto o SDK oficial (`mercadopago`). O `idCheckout` é o id da preferência; a consulta encontra o pagamento pela `external_reference` (id da recarga).
- **Stripe (Checkout Session):** o `AdaptadorStripe` adapta direto o SDK oficial (`stripe`). O `idCheckout` é o id da sessão (`cs_...`), e a recarga vai como `client_reference_id`. Sessão paga é APROVADO, aberta é PENDENTE e expirada é RECUSADO.

### Configurando as APIs de pagamento (modo de teste)

Os processadores reais são opcionais: sem credenciais, `npm run demo` e os testes rodam normalmente com processadores simulados. Para usar o Mercado Pago e o Stripe de verdade, **sempre em modo de teste**:

**1. Crie o `.env`** a partir do modelo. Ele é ignorado pelo git; nunca commite credenciais.

```bash
cp .env.example .env
```

**2. Mercado Pago (Checkout Pro)**

1. Entre no [painel de desenvolvedores](https://www.mercadopago.com.br/developers/panel/app) com a sua conta e crie uma aplicação (Checkout Pro).
2. Em [Contas de teste](https://www.mercadopago.com.br/developers/panel/test-users), crie dois usuários: um **vendedor** e um **comprador**. Anote o usuário e a senha de cada um.
3. Saia da sua conta, entre com o **vendedor de teste**, crie uma aplicação nele e copie o *access token* de **produção** dessa aplicação (`APP_USR-...`). Como a conta é de teste, os links também são de teste.
4. Cole no `.env` em `MERCADO_PAGO_ACCESS_TOKEN`.

> Não use o token da sua conta pessoal: ele gera links de cobrança real. O demo confere a conta dona do token e recusa contas que não sejam de teste.

**3. Stripe (Checkout Session)**

1. No [dashboard do Stripe](https://dashboard.stripe.com/test/apikeys), ative o **modo de teste** (*Test mode*).
2. Em *Developers → API keys*, copie a **Secret key** (`sk_test_...`).
3. Cole no `.env` em `STRIPE_SECRET_KEY`.

> No Stripe, o modo vem na própria chave: `sk_test_` é teste e `sk_live_` é produção. O demo recusa chaves `live`.

**Variáveis do `.env`**

| Variável | Obrigatória | O que é |
| -- | -- | -- |
| `MERCADO_PAGO_ACCESS_TOKEN` | para o Mercado Pago | Token do vendedor de teste (`APP_USR-...`) ou credencial `TEST-...` |
| `MERCADO_PAGO_WEBHOOK_SECRET` | não | Segredo usado para assinar o aviso simulado que passa pelo Proxy |
| `STRIPE_SECRET_KEY` | para o Stripe | Chave secreta de teste (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | não | Segredo usado para assinar o aviso simulado que passa pelo Proxy |
| `PERMITIR_PRODUCAO` | não | `1` libera credenciais de produção (**cobrança real**). Não use. |

### Executando os demos da F1

| Comando | Precisa de `.env`? | O que mostra |
| -- | -- | -- |
| `npm run demo` | não | História completa narrada, com processadores simulados |
| `npm run demo:interativo` | opcional | **Você é o espectador**: escolhe pacote, forma e meio de pagamento e paga |
| `npm run demo:mp` | sim (Mercado Pago) | Recarga do pacote de R$ 10 no Mercado Pago, do link ao crédito |
| `npm run demo:stripe` | sim (Stripe) | Recarga do pacote de R$ 10 no Stripe, do link ao crédito |

#### `demo:interativo`: você no papel do espectador

```bash
npm run demo:interativo
```

1. **Conexão:** o demo conecta nos processadores configurados no `.env`; os que faltarem só não aparecem no modal. Sempre existem dois meios sem internet: **Simulado** e **Simulado-ForaDoAr**.
2. **Carteira:** você começa com R$ 50,00 em dinheiro e 0 de moeda virtual.
3. **[Decorator] Pacote:** escolha um dos pacotes; o demo mostra o preço original, o promocional e a composição das camadas.
4. **Forma de pagamento:**
   - `1` meio externo: segue para a escolha do meio;
   - `2` saldo em dinheiro da carteira: conclui na hora, ou cancela se o saldo não bastar.
5. **[Adapter] Meio de pagamento:** escolha MercadoPago, Stripe, Simulado ou Simulado-ForaDoAr. Escolhendo o **Simulado-ForaDoAr**, aparece *"indisponível no momento. Escolha outro meio"* e o menu volta só com as alternativas.
6. **Pagamento:** o demo mostra o link (ou o protocolo, no Simulado). Depois:
   - **Enter** consulta o status no processador;
   - `p` / `r` simulam pagamento aprovado / recusado (só no Simulado);
   - `c` desiste da recarga.
7. **[Proxy]:** aprovado o pagamento, o aviso assinado passa pelo Proxy e aparece `CREDITADO`; em seguida o mesmo aviso é reenviado e aparece `DUPLICADO` (O11).
8. A carteira é exibida de novo. Digite `0` para sair.

Roteiros para experimentar:

- **Fluxo feliz sem internet:** pacote `2` → forma `1` → meio Simulado → `p`.
- **Meio fora do ar:** pacote `2` → forma `1` → Simulado-ForaDoAr → escolha outro meio entre as alternativas.
- **Saldo insuficiente:** pacote de R$ 100 → forma `2` (o saldo é R$ 50).
- **Pagamento recusado:** meio Simulado → `r`.
- **Processador real:** meio MercadoPago ou Stripe → pague no link (veja abaixo) → tecle Enter até aparecer `APROVADO`.

#### `demo:mp` e `demo:stripe`

```bash
npm run demo:mp
npm run demo:stripe
```

Os dois compram o pacote de R$ 10 (R$ 7,46 com a promoção), imprimem o link e consultam o pagamento a cada 5 segundos, por até 5 minutos. Ao detectar a aprovação, passam o aviso pelo Proxy e mostram o crédito. `Ctrl+C` encerra antes.

#### Como pagar em modo de teste

| Processador | Como pagar |
| -- | -- |
| Mercado Pago | Abra o link em **aba anônima** e entre com o **comprador de teste**. Pague com um dos cartões de teste da documentação do Checkout Pro; com o nome do titular `APRO`, o pagamento é aprovado. |
| Stripe | Cartão `4242 4242 4242 4242`, qualquer validade futura, qualquer CVC, nome e e-mail. O cartão `4000 0000 0000 0002` simula recusa. Pix de teste aparece se estiver habilitado na conta. |

Depois de pagar no Stripe, a página redireciona para `localhost:3000` e dá erro; isso é esperado, porque o demo confirma o pagamento por consulta e não por essa página.

#### Problemas comuns

| Sintoma | Causa e solução |
| -- | -- |
| `... não configurado no .env` | Falta a variável; confira o nome e se o `.env` está na raiz do projeto. |
| `Este token é da sua conta REAL` | Você usou o token da conta pessoal; use o do **vendedor de teste**. |
| Erro ao pagar no Mercado Pago | Você está logado na conta pessoal ou na do vendedor; pague em aba anônima com o **comprador de teste**. |
| Fica `PENDENTE` para sempre | O pagamento não foi concluído. No Stripe, um Pix gerado e não pago fica pendente até a sessão expirar (30 min). |
| `INCONSISTENTE` no Proxy | O pagamento não confere com a recarga (outra referência, outro valor ou outro checkout). |

> Limitação conhecida: ainda não há endpoint HTTP recebendo o webhook real dos processadores. Os demos detectam a aprovação por consulta e montam localmente o aviso assinado que passa pelo Proxy.

---

## A História da Demonstração Integrada

A demonstração executável (`npm run demo`) integra a narrativa em 4 etapas no terminal:

1. **Recarga de moeda virtual (F1):** montagem de preço em camadas, checkout no meio de pagamento escolhido (com alternativas se ele estiver indisponível) e confirmação segura.
2. **Doação com mensagem (F2):** débito/crédito atômico e orquestração da doação via Facade.
3. **Mensagem destacada no chat (F3):** exibição decorada no chat (assíncrona, paralela ao passo 4).
4. **Repasse ao criador (F2):** acionado pela doação, independente da exibição no chat (coerente com a regra da modelagem da Entrega 2).

### Front-end (`npm run web`)

A mesma história em uma página web, servida por um servidor HTTP mínimo (`src/web/servidor.ts`, só módulos do Node) que chama o código real das três frentes. Abra `http://localhost:3000` (outra porta: `PORT=3001 npm run web`).

| Parte da tela | Frente e padrões |
| -- | -- |
| Recarga (F1) | Pacotes com o preço calculado em camadas (Decorator), escolha do meio de pagamento (Adapter) e aviso de pagamento verificado antes de creditar (Proxy). Mostra só o último pedido. |
| Doação (F2) | Facade com Mediator, com as regras de canal monetizado, saldo e limite de caracteres. Atalhos com o mínimo de cada faixa, ou qualquer outro valor. A mensagem é opcional: sem ela (ou abaixo de 200 moedas) a página usa a doação simples da F2, que não passa pelo chat. |
| Notificações do criador | Doações recebidas com sucesso e o repasse de cada uma. |
| Chat (F3) | Mensagem destacada montada pelo Decorator: a página pinta a mensagem com a cor devolvida por `ComFaixaCor` e a mantém fixada no topo do chat, em versão compacta (o hover mostra a mensagem inteira), pelo tempo de `ComFixacao`; `ComLimiteCaracteres` recusa a mensagem acima do limite. Também dá para escrever mensagens comuns. |

Meios de pagamento:

- **Mercado Pago e Stripe reais (modo de teste):** aparecem quando o `.env` tem as credenciais (ver [Configurando as APIs de pagamento](#configurando-as-apis-de-pagamento-modo-de-teste)). Ao comprar, a página mostra o link do checkout; pague nele com o comprador de teste ou o cartão de teste e clique em "Verificar pagamento". Como o processador não alcança o `localhost` para chamar o webhook, a página consulta o pagamento e, se aprovado, monta o aviso assinado, que passa pelo Proxy (o mesmo que o `demo:interativo` faz).
- **Simulado-A e Simulado-B:** funcionam sem credenciais. "Pagar" simula o pagamento, e "Fora do ar" tira o meio do ar para mostrar o Adapter avisando e sugerindo outro meio.

Os botões de velocidade (1x, 10x, 100x e 1000x) aceleram o relógio da demonstração, para ver a fixação das mensagens acabar sem esperar o tempo real. Ao subir, o servidor diz no terminal quais processadores reais conectou. O estado fica em memória e é o mesmo para todas as abas; use "Reiniciar" para começar do zero.

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
