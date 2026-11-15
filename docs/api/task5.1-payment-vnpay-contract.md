# Task 5.1 – API Contract, Prisma Schema & Transaction Interface (Hiển #22 ↔ Khoa #20)

> **Người thực hiện:** Nguyễn Minh Hiển (`@mhien06`) — Issue #22
> **Phối hợp & Review:** Trần Đăng Khoa (`@khoadangtran141006-svg`) — Issue #20
> **Căn cứ:** [SRS](../requirements/srs.md), [Use Case Checkout](../requirements/use-case-checkout.md), [Domain Class](../diagrams/domain-class.md), [Sequence Checkout](../diagrams/sequence-checkout.md), [Architecture & ADR 004–008, 011](../architecture/architecture.md)

---

## 1. API Contract thuộc phạm vi PaymentModule (Hiển #22)

| Method | Endpoint | Quyền | Mục đích |
|---|---|---|---|
| `POST` | `/payments` *(và `/orders/:id/payments`)* | `JwtAuthGuard` + `RolesGuard` (`@Roles("CUSTOMER")`, chủ đơn) | Tạo lượt thanh toán VNPay Sandbox (`Payment` attempt) với DTO kiểm tra (`CreatePaymentDto` / `CreateOrderPaymentDto`) và header `Idempotency-Key`. |
| `GET` | `/payments/:id` | `JwtAuthGuard` + `RolesGuard` (`@Roles("CUSTOMER")`, chủ đơn, `ParseUUIDPipe`) | Lấy chi tiết và trạng thái đã xác minh của một lượt thanh toán. |
| `GET` | `/orders/:id/payment-status` | `JwtAuthGuard` + `RolesGuard` (`@Roles("CUSTOMER")`, chủ đơn, `ParseUUIDPipe`) | Lấy snapshot trạng thái đơn hàng (`OrderStatus`), các khoản tiền chính thức (`totalAmount`, `pointsRedeemed`, `pointsDiscountAmount`, `vnpayPayableAmount`), lượt thanh toán mới nhất và cờ `canPay` / `canRetry` / `needsReview`. |
| `GET` | `/payments/vnpay/ipn` | Public (VNPay Server-to-Server) | Nhận IPN từ VNPay Sandbox, xác minh chữ ký HMAC-SHA512, `vnp_TmnCode`, `vnp_TxnRef`, `vnp_Amount` và gọi hàm giao dịch xử lý kết quả thanh toán dùng chung. Trả `RspCode` (`00`, `01`, `02`, `04`, `97`, `99`). |
| `GET` | `/payments/vnpay/return` | Public | Kiểm tra chữ ký tham số Return URL để hỗ trợ điều hướng hiển thị (`authoritative: false`, tuyệt đối không cập nhật `Order`/`Payment`). Frontend hỗ trợ cả `/payment/return` và `/checkout/return`. |

### Request / Response mẫu khi tạo Payment

- **Header:** `Idempotency-Key: <uuid-hoặc-chuỗi-1..128-ký-tự>`
- **Body (`POST /payments`):**
  ```json
  {
    "orderId": "11111111-1111-4111-8111-111111111111"
  }
  ```
- **Response (`201 Created`):**
  ```json
  {
    "paymentId": "22222222-2222-4222-8222-222222222222",
    "orderId": "11111111-1111-4111-8111-111111111111",
    "orderStatus": "PENDING",
    "provider": "VNPAY_SANDBOX",
    "transactionRef": "9f8e7d6c5b4a...",
    "idempotencyKey": "idem-key-001",
    "amount": 29050,
    "status": "PENDING",
    "createdAt": "2026-11-15T10:00:00.000Z",
    "expiresAt": "2026-11-15T10:05:00.000Z",
    "orderExpiresAt": "2026-11-15T10:15:00.000Z",
    "verifiedAt": null,
    "awaitingVerification": false,
    "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
    "needsReview": false
  }
  ```

---

## 2. Yêu cầu Prisma Schema cho `Payment`, `VNPayRefundRecord` và `PaymentEvent` (Gửi Khoa #20 tích hợp migration chung)

Để không tạo migration xung đột với `apps/api/prisma/schema.prisma` do Khoa quản lý ở Issue #20, dưới đây là định nghĩa model và ràng buộc unique/index cần có cho phần Payment:

```prisma
enum OrderStatus {
  PENDING
  PAYMENT_FAILED
  PAYMENT_EXCEPTION
  PAID
  PREPARING
  READY_FOR_PICKUP
  COMPLETED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
  UNKNOWN
  EXPIRED
}

enum PaymentProvider {
  VNPAY_SANDBOX
}

enum RefundStatus {
  PENDING
  SUCCEEDED
  FAILED
  UNKNOWN
}

enum LoyaltyTransactionType {
  EARN
  REDEEM
  RETURN_REDEEMED
  REVERSE_EARNED
  VNPAY_COMPENSATION
  ADJUST
}

model Payment {
  id                    String               @id @default(uuid()) @db.Uuid
  orderId               String               @db.Uuid
  provider              PaymentProvider      @default(VNPAY_SANDBOX)
  status                PaymentStatus        @default(PENDING)
  amount                Int                  // VND nguyên, phải bằng Order.vnpayPayableAmount
  transactionRef        String               @unique
  idempotencyKey        String               @unique
  payloadHash           String
  paymentUrl            String
  providerTransactionNo String?
  responseCode          String?
  transactionStatus     String?
  bankCode              String?
  payDate               String?
  createdAt             DateTime             @default(now())
  expiresAt             DateTime
  verifiedAt            DateTime?
  nextQueryAt           DateTime
  queryAttempts         Int                  @default(0)
  reviewRequired        Boolean              @default(false)
  settlementSource      String?              // "IPN" | "QUERY"
  refundRecords         VNPayRefundRecord[]

  @@index([orderId, createdAt])
  @@index([status, nextQueryAt])
}

model VNPayRefundRecord {
  id                String       @id @default(uuid()) @db.Uuid
  paymentId         String       @db.Uuid
  amount            Int
  status            RefundStatus @default(PENDING)
  providerRefundRef String?
  requestedAt       DateTime     @default(now())
  resolvedAt        DateTime?
  payment           Payment      @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@index([paymentId, status])
}
```

---

## 3. Giao diện Transaction Port & Tích hợp Prisma (`PAYMENT_REPOSITORY_PORT` & `PAYMENT_COMPENSATION_PORT`)

- `PaymentModule` liên kết trực tiếp với `PrismaModule`, `AuthModule`, `InventoryModule`, `LoyaltyModule` và `VnpayModule`:
  - `PAYMENT_REPOSITORY_PORT` (`apps/api/src/payment/payment.contracts.ts`) được cung cấp bởi `PrismaPaymentRepository` (`apps/api/src/payment/prisma-payment.store.ts`), sử dụng PostgreSQL row lock (`FOR UPDATE`, `FOR UPDATE SKIP LOCKED`) trong cùng Prisma `$transaction`.
  - `PAYMENT_COMPENSATION_PORT` (`apps/api/src/order/payment-compensation.port.ts`) được cung cấp bởi `PrismaPaymentCompensationAdapter` và export cho `OrderModule` (`OrderService.cancelOrder`).
1. **Khi xác minh thanh toán thành công (`PaymentSettlementService.settle`):** gọi `InventoryService.deductIngredientsForOrder(...)` và `LoyaltyService.recordInTransaction(...)` (EARN tính theo `LoyaltyService.getEarnPoints`) trong cùng một Prisma transaction với khóa dòng `Order` → `Payment`.
2. **Khi hủy đơn đã `PAID` trước `PREPARING` (`OrderService.cancelOrder`):** gọi `PAYMENT_COMPENSATION_PORT.compensatePaidOrderCancellation(...)` để kiểm tra `VNPayRefundRecord` cũ và cấp điểm bù `VNPAY_COMPENSATION = ceil(actualPaidVnd / 100)` đúng một lần theo khóa `vnpay-comp:<paymentId>`.
