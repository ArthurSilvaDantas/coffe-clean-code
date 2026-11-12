<div align="center">

# Cafeteria API

**API REST refatorada com Clean Code e com a qualidade dos testes validada por teste de mutação**

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)](package.json)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Jest](https://img.shields.io/badge/Jest-57%20testes-C21325?logo=jest&logoColor=white)](tests/)
[![Mutation score](https://img.shields.io/badge/mutation%20score-97.75%25-brightgreen)](#teste-de-mutação)

[Clean code](#clean-code) · [Teste de mutação](#teste-de-mutação) · [Endpoints](#endpoints) · [Testes](tests/)

</div>

## Visão geral

API REST para gerenciamento de pedidos de uma cafeteria, feita com Node.js e Express: clientes,
produtos, pedidos com entrega, cupons, pagamentos (PIX, crédito parcelado, débito e dinheiro),
programa de fidelidade e cancelamento com reembolso.

O projeto tem dois focos:

1. **Clean code**: refatoração incremental de um código legado para uma arquitetura em camadas,
   com regras de negócio centralizadas, nomes claros e erros padronizados.
2. **Teste de mutação**: uso do [StrykerJS](https://stryker-mutator.io/) para medir se a suíte de
   testes realmente detecta defeitos, e não apenas se executa o código, e fortalecê-la a partir dos
   defeitos que passavam despercebidos.

## Destaques

- Refatoração feita em **6 etapas**, cada uma num pull request: estilo e formatação, linguagem
  ubíqua, nomes legíveis, números mágicos, fluxos de execução e coesão/acoplamento.
- Arquitetura em camadas: `routes → controllers → services → repositories → data`.
- **57 testes automatizados** de integração da API com Jest e Supertest.
- **Escore de mutação de 84,27% → 97,75%** nas regras de cálculo (100% dos mutantes não equivalentes).
- Diagnóstico e correção de **falsos positivos no teste de mutação** causados por esgotamento de
  portas TCP na infraestrutura de testes.
- ESLint e Prettier configurados.

## Clean code

O código original tinha regras de negócio nos controllers, valores fixos espalhados pelo código e
termos diferentes para o mesmo conceito. A refatoração foi feita em etapas pequenas, sem mudar o
comportamento, com os testes garantindo cada passo:

| Etapa                   | O que mudou                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1. Estilo e formatação  | Prettier e ESLint aplicados, igualdade estrita nas comparações e remoção de código não utilizado               |
| 2. Linguagem ubíqua     | Um único termo para cada conceito (`customer`, `order`, `price`, `total`, `quantity`) e glossário do domínio   |
| 3. Nomes legíveis       | Funções, variáveis e métodos de repositório renomeados; comentários que só repetiam o código removidos         |
| 4. Números mágicos      | Descontos, taxas, limites e regras de pagamento extraídos para constantes em `src/constants`                   |
| 5. Fluxos de execução   | Validação separada do processamento, cálculo de totais em funções menores e _guard clauses_ na troca de status |
| 6. Coesão e acoplamento | Camadas com acesso a dados em repositórios, regras em services sem Express e erros padronizados com `AppError` |

## Teste de mutação

Cobertura de código diz se uma linha foi **executada** pelos testes. O teste de mutação diz se os
testes **perceberiam um defeito** nela. O StrykerJS gera versões do código com pequenos defeitos
(**mutantes**), como trocar `>=` por `>` ou `Math.max` por `Math.min`, e roda a suíte contra cada
uma. Se algum teste falha, o mutante foi **morto**. Se todos passam, o defeito passou despercebido.

### Resultado

Foram mutadas as regras de cálculo da API: `pricingService` (descontos, frete e total),
`loyaltyService` (pontos e upgrade para premium) e `utils/money` (arredondamento e formatação).

|                           | Testes | Mutantes | Mortos | Vivos | Escore     |
| ------------------------- | ------ | -------- | ------ | ----- | ---------- |
| Suíte original            | 50     | 89       | 75     | 14    | 84,27%     |
| Com os testes novos       | 57     | 89       | 87     | 2     | **97,75%** |
| Descontando equivalentes¹ | 57     | 87       | 87     | 0     | **100%**   |

¹ Os 2 sobreviventes são **mutantes equivalentes**: mudam o código, mas não o comportamento. Um
deles troca `total * POINTS_PER_REAL` por `total / POINTS_PER_REAL`, e como a constante vale 1, o
resultado é o mesmo. Nenhum teste pode distingui-los.

### O que os mutantes sobreviventes revelaram

Os 14 sobreviventes apontaram lacunas reais na suíte original. Os 7 testes criados para eliminá-los
ficam em [`tests/mutacao/`](tests/mutacao), um arquivo por módulo mutado:

- **Fronteiras nunca testadas:** desconto a partir de **exatamente** R$ 100, frete grátis a partir
  de **exatamente** R$ 50 e upgrade para premium com **exatamente** 200 pontos. Os testes usavam
  valores próximos (105, 52,50, 216) e não percebiam um `>=` trocado por `>`.
- **Asserções incompletas:** o teste de pontos de fidelidade não verificava o **tipo** do cliente
  depois do pagamento, e por isso 4 mutantes que o promoviam a premium indevidamente passavam.
- **Cenários que mascaravam o defeito:** o teste de estorno cancelava o **único** pedido do
  cliente, e nesse caso `Math.max(x, 0)` e `Math.min(x, 0)` dão o mesmo resultado.
- **Só o status HTTP era verificado:** a formatação em reais (`R$ 10,00`) só aparece em mensagens
  de erro, e os testes conferiam apenas o status 400.

### Falsos positivos na infraestrutura

Na primeira execução, centenas de mutantes apareceram como "mortos" por **erro de rede**
(`EADDRNOTAVAIL`), não por um teste ter detectado a mutação. O `supertest(app)` abria um servidor
HTTP numa porta nova **a cada requisição**, e com o Stryker rodando vários processos do Jest em
paralelo, as portas locais se esgotavam.

A correção ficou em [`tests/helpers.js`](tests/helpers.js), sem alterar nenhum teste: cada arquivo
de teste usa um único servidor com conexões keep-alive. Depois dela, nenhum mutante foi morto por
erro de rede. Também foi preciso desativar o `--findRelatedTests` do Jest, que não rastreava a
relação entre os testes de API e os services.

### Como executar

```bash
npm run mutacao:inicial   # Stryker com a suíte original
npm run mutacao:final     # Stryker com a suíte completa
```

O relatório HTML é gerado em `reports/mutation/<inicial|final>/index.html`. Ele mostra o código
original, cada mutante com seu diff e qual teste o matou.

## Requisitos

- Node.js 20 ou superior

## Instalação

```bash
npm install
```

## Execução

```bash
npm run dev     # modo desenvolvimento (reinicia ao salvar)
npm start       # modo normal
```

A API sobe em `http://localhost:3000` (ou na porta definida em `PORT`).

## Testes e qualidade

```bash
npm test              # todos os testes
npm run test:inicial  # só a suíte original (sem tests/mutacao)
npm run lint          # ESLint
npm run lint:fix      # ESLint com correção automática
npm run format        # Prettier (formata os arquivos)
npm run format:check  # Prettier (apenas verifica)
```

## Organização do código

Cada camada conhece apenas a camada abaixo dela:

```text
routes → controllers → services → repositories → data
```

| Pasta              | Responsabilidade                                                                    |
| ------------------ | ----------------------------------------------------------------------------------- |
| `src/routes`       | Liga cada rota HTTP ao seu controller.                                              |
| `src/controllers`  | Lê a requisição, chama o service e envia a resposta. Não contém regras de negócio.  |
| `src/services`     | Regras de negócio. Não conhece o Express e lança `AppError` quando algo é inválido. |
| `src/repositories` | Único ponto de acesso aos dados em memória (`src/data`).                            |
| `src/constants`    | Regras de negócio (`businessRules.js`) e valores fixos do domínio (`domain.js`).    |
| `src/errors`       | `AppError`, com o status HTTP de cada erro.                                         |
| `src/middlewares`  | Converte erros em respostas no formato `{ "error": "mensagem" }`.                   |
| `src/utils`        | Funções genéricas sem regra de negócio: dinheiro, cartão e data.                    |

Services do domínio de pedidos:

- `orderService`: criação, consulta, itens e cupons
- `orderStatusService`: transições de status e cancelamento
- `pricingService`: subtotal, descontos, taxa de entrega e total
- `paymentService` e `paymentMethods`: fluxo do pagamento e cada forma de pagamento
- `loyaltyService`: pontos de fidelidade

## Glossário do domínio

Termos usados de forma única no código, na API e nos testes.

| Termo          | Significado                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------- |
| `customer`     | Cliente da cafeteria. Pode ser `regular` ou `premium` e acumula `points` de fidelidade.     |
| `product`      | Item do cardápio, com `price`, `stock` e `category` (`coffee`, `food` ou `drink`).          |
| `order`        | Pedido feito por um cliente, identificado pelo `customerId`.                                |
| `item`         | Produto dentro de um pedido, com `productId`, `name`, `price` e `quantity`.                 |
| `price`        | Preço unitário de um produto.                                                               |
| `quantity`     | Quantidade de unidades de um produto.                                                       |
| `subtotal`     | Soma de `price × quantity` dos itens do pedido.                                             |
| `discount`     | Desconto aplicado ao pedido (tipo de cliente e cupom).                                      |
| `deliveryFee`  | Taxa de entrega.                                                                            |
| `total`        | Valor final: no pedido, `subtotal - discount + deliveryFee`; no pagamento, o valor cobrado. |
| `coupon`       | Cupom de desconto aplicado ao pedido.                                                       |
| `deliveryType` | Forma de recebimento: `pickup` (retirada) ou `delivery` (entrega).                          |
| `payment`      | Pagamento de um pedido, identificado pelo `orderId`.                                        |
| `status`       | Situação do pedido no seu ciclo de vida.                                                    |
| `refund`       | Valor devolvido ao cliente no cancelamento.                                                 |

Os valores fixos do domínio (status, tipos, cupons, formas de pagamento e categorias) ficam em `src/constants/domain.js`, e as regras de negócio (descontos, taxas, limites e pontos) ficam em `src/constants/businessRules.js`.

## Endpoints

| Método | Rota                    | Descrição                                          |
| ------ | ----------------------- | -------------------------------------------------- |
| GET    | `/health`               | Verifica se a API está no ar                       |
| POST   | `/customers`            | Cadastra cliente                                   |
| GET    | `/customers`            | Lista clientes (`?type=premium`)                   |
| GET    | `/customers/:id`        | Consulta cliente                                   |
| GET    | `/customers/:id/orders` | Lista pedidos do cliente (`?status=`)              |
| POST   | `/products`             | Cadastra produto                                   |
| GET    | `/products`             | Lista produtos (`?category=`, `?available=true`)   |
| PATCH  | `/products/:id/stock`   | Ajusta estoque (`quantity` positiva ou negativa)   |
| POST   | `/orders`               | Cria pedido                                        |
| GET    | `/orders`               | Lista pedidos (`?status=`, `?customerId=`)         |
| GET    | `/orders/:id`           | Consulta pedido                                    |
| POST   | `/orders/:id/items`     | Adiciona item ao pedido                            |
| POST   | `/orders/:id/coupon`    | Aplica cupom (`CAFE10`, `BEMVINDO`, `FRETEGRATIS`) |
| POST   | `/orders/:id/pay`       | Paga o pedido                                      |
| PATCH  | `/orders/:id/status`    | Atualiza status                                    |
| POST   | `/orders/:id/cancel`    | Cancela pedido                                     |

Status possíveis: `CREATED`, `PAID`, `PREPARING`, `READY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`.

Formas de pagamento: `pix`, `credit_card`, `debit_card`, `cash`.

## Exemplos

```bash
# cadastrar cliente
curl -X POST localhost:3000/customers -H 'Content-Type: application/json' \
  -d '{"name":"Maria Souza","email":"maria@email.com","type":"premium"}'

# listar produtos
curl localhost:3000/products

# criar pedido com entrega
curl -X POST localhost:3000/orders -H 'Content-Type: application/json' \
  -d '{"customerId":1,"deliveryType":"delivery","address":"Rua A, 10","distance":4,"items":[{"productId":2,"quantity":2}]}'

# adicionar item
curl -X POST localhost:3000/orders/1/items -H 'Content-Type: application/json' \
  -d '{"productId":4,"quantity":3}'

# aplicar cupom
curl -X POST localhost:3000/orders/1/coupon -H 'Content-Type: application/json' -d '{"code":"CAFE10"}'

# pagar com cartão de crédito
curl -X POST localhost:3000/orders/1/pay -H 'Content-Type: application/json' \
  -d '{"method":"credit_card","cardNumber":"4111 1111 1111 1111","installments":2}'

# pagar em dinheiro
curl -X POST localhost:3000/orders/1/pay -H 'Content-Type: application/json' \
  -d '{"method":"cash","cashGiven":50}'

# atualizar status
curl -X PATCH localhost:3000/orders/1/status -H 'Content-Type: application/json' -d '{"status":"PREPARING"}'

# cancelar
curl -X POST localhost:3000/orders/1/cancel -H 'Content-Type: application/json' -d '{"reason":"Cliente desistiu"}'
```
