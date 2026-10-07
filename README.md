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
