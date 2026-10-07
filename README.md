# Cafeteria API

API REST para gerenciamento de pedidos de uma cafeteria, feita com Node.js e Express. Os dados ficam em memória e são reiniciados a cada execução.

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
npm test              # testes automatizados
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
