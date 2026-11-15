# Task 5.1 — Auth, Cart, Order, Inventory & Loyalty Contract

This contract describes the Issue #20 implementation on
`feature/task5-1-auth-orders`. The VNPay provider and public payment routes belong
to Issue #22; payment settlement is not complete until that module is integrated.

## Authentication and authorization

- `POST /auth/register` — create a `CUSTOMER`, password hashed with bcrypt, and
  their cart; returns a JWT session.
- `POST /auth/login` — authenticate and return a JWT session.
- `GET /auth/me` — return the authenticated profile.
- Send the token as `Authorization: Bearer <token>`. Server-side roles are
  `CUSTOMER`, `STAFF`, and `MANAGER`; a Manager can use Staff order operations.
- Registration never accepts a caller-selected role.

## Customer routes

All routes below require a `CUSTOMER` JWT.

| Method and route | Behavior |
|---|---|
| `GET /cart` | Get the caller's cart. |
| `POST /cart/items` | Add a product using option UUIDs and quantity; the API validates availability and calculates prices from the database. |
| `PATCH /cart/items/:id` | Change size, toppings, or quantity for an item owned by the caller. |
| `DELETE /cart/items/:id` | Remove an item owned by the caller. |
| `POST /orders/quote` | Calculate the current cart total and optional points discount without creating an order. |
| `POST /orders` | Revalidate prices, create an order snapshot, and clear the cart atomically. |
| `GET /orders` | List only the caller's orders. |
| `GET /orders/:id` | Get a caller-owned order, items, and latest payment summary. |
| `POST /orders/:id/cancel` | Cancel an eligible caller-owned order before preparation. |
| `GET /loyalty` | Get the caller's point balance and recent ledger entries. |

`POST /orders/quote` and `POST /orders` accept `{ "pointsRedeemed": 0 }`;
`pointsRedeemed` may be omitted. Quote and create use the same pricing logic.
Prices, totals, and point amounts are integer VND/points. The order response
includes UUID `id`, `orderCode`, status, amount breakdown, `expiresAt`, and item
snapshots.

## Staff and Manager routes

Staff JWTs, and Manager JWTs where noted, are required.

| Method and route | Role | Behavior |
|---|---|---|
| `GET /staff/orders` | Staff or Manager | List orders awaiting or in fulfillment. |
| `PATCH /staff/orders/:id/status` | Staff or Manager | Advance only `PAID → PREPARING → READY_FOR_PICKUP → COMPLETED`. |
| `POST /staff/orders/:id/cancel` | Staff or Manager | Cancel an eligible `PAID` order before preparation; a reason is required. |
| `GET /staff/inventory/ingredients` | Manager | List ingredients and on-hand quantities. |
| `POST /staff/inventory/ingredients` | Manager | Create an ingredient. |
| `PATCH /staff/inventory/ingredients/:id/stock` | Manager | Apply an audited stock adjustment with a reason. |
| `GET /staff/inventory/recipes` | Manager | List active recipes with product and ingredient details. |
| `POST /staff/inventory/recipes` | Manager | Create a new recipe version. |
| `PATCH /manager/products/:id/availability` | Manager | Change product availability with a required reason and audit record. |

## Order, inventory, and loyalty transaction rules

- A new order is `PENDING` for 15 minutes. Creating it checks recipe/stock
  sufficiency but does not decrement stock.
- A payment provider must verify the VNPay result before setting the order to
  `PAID`. Successful settlement must call inventory deduction and point earning
  using the same Prisma transaction as the payment/order state update.
- `InventoryService.checkIngredientsForOrder(tx, orderId)`,
  `deductIngredientsForOrder(tx, orderId)`, and
  `restoreIngredientsForOrder(tx, orderId)` accept a
  `Prisma.TransactionClient`. Deduction locks ingredient rows, aggregates recipe
  requirements, snapshots actual usage, and is idempotent. Restore uses recorded
  usage and is idempotent.
- `LoyaltyService.recordInTransaction(tx, input)`,
  `returnRedeemedPoints(tx, input)`, and `reverseEarnedPoints(tx, input)` accept
  the same transaction context. Ledger idempotency keys and row locking prevent
  duplicate balance effects.
- The payment module must share the underlying Prisma transaction; it must not
  start a nested/independent transaction around these calls.
- `PAYMENT_COMPENSATION_PORT` is the integration point for paid-order
  cancellation. It receives the shared Prisma transaction and verified payment
  identifiers. Issue #22 must provide this port and ensure its refund-record
  checks prevent duplicate compensation. Until the provider is registered,
  paid-order cancellation fails explicitly with `503`; no partial cancellation
  is committed.
- IPN and server-side QueryDR processing must be idempotent. QueryDR is an
  internal reconciliation operation, not a public customer endpoint. A late
  success or insufficient stock is recorded for reconciliation/compensation;
  this contract does not initiate a new VNPay refund.

## Payment persistence handoff

Issue #20 owns the Prisma models and migrations. `Order.id` and `Payment.id` are
UUIDs. The Payment model has `PENDING`, `SUCCEEDED`, `FAILED`, `UNKNOWN`, and
`EXPIRED` statuses; Order has separate fulfillment/payment-exception statuses.
`PaymentEvent`, `VNPayRefundRecord`, provider transaction metadata, and the
unique `transactionRef`/`idempotencyKey` fields support Issue #22's audit and
reconciliation work. Payment state must not be inferred from the browser return
route.

Issue #22 owns `POST /payments`, `GET /payments/:id`, the agreed
`GET /payments/vnpay/ipn` callback, and the customer payment-status lookup route.
The exact request/response fields follow Hiển's Payment contract. QueryDR runs
only in the backend; it is not exposed as a customer API.

## Loyalty policy decisions still required

The SRS intentionally leaves regular EARN rate configurable and does not
approve a redemption conversion rate. No numerical default is embedded:

- `LOYALTY_EARN_POINTS_PER_VND` and `LOYALTY_EARN_ROUNDING` must be configured
  together; when absent, regular EARN is zero.
- `LOYALTY_REDEEM_VND_PER_POINT` must be configured before redeeming points;
  otherwise a positive redemption request is rejected.
- Before enabling either policy, the team must approve its numeric value, the
  amount used as the EARN base after discounts, and how reversal behaves if
  already-earned points have since been spent. A reversal can produce a
  negative balance under the current ledger model.

The Issue #22 settlement must call `LoyaltyService.getEarnPoints(amountVnd)` and
`recordInTransaction(...)`; it must not hard-code an earning formula such as
`Math.floor(amount / 1000)`.
