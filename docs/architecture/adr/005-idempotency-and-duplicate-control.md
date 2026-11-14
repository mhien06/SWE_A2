# ADR-005: Idempotency nhiều lớp và kiểm soát xử lý trùng

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-14
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), `docs/requirements/context-and-scope.md`

## Context

- Client có thể gửi lại yêu cầu; VNPay có thể gửi IPN lặp; scheduler và IPN có thể xử lý cùng một đơn; hủy và thanh toán có thể đồng thời.
- Sai sót dẫn đến trừ kho hai lần, cộng/bù điểm nhiều lần hoặc xác nhận đơn sai.

## Decision

Áp dụng bốn lớp độc lập (chi tiết ở `architecture.md` mục 6.3):

1. **HTTP:** header `Idempotency-Key` cho tạo đơn, tạo URL thanh toán, hủy đơn; bảng `idempotency_key` unique `(userId, key)` lưu `requestHash` và phản hồi. Cùng key nhưng khác nội dung → từ chối (`422`); cùng key và cùng nội dung → trả lại phản hồi cũ.
2. **Giao dịch:** `Payment.txnRef` unique; IPN lưu `payment_event` unique `(txnRef, transactionNo)`; giao dịch đã ở trạng thái cuối thì chỉ trả `RspCode 02`.
3. **Đồng thời:** `SELECT … FOR UPDATE` đơn và giao dịch trong transaction.
4. **Hiệu ứng phụ:** unique `(orderId, ingredientId, type)` trên `InventoryMovement`; unique `(orderId, type)` và `(paymentId, type)` trên `LoyaltyTransaction`.

Mọi đường vào xử lý kết quả thanh toán (IPN, đối soát, thanh toán lại) dùng **chung một hàm**.

## Consequences

- (+) Kết quả đúng ngay cả khi tầng ứng dụng có lỗi hoặc có nhiều bản API chạy song song.
- (+) Có thể test bằng cách gửi lặp cùng một IPN/yêu cầu.
- (−) Thêm bảng và xử lý lỗi vi phạm unique; bản ghi idempotency cần dọn định kỳ (TTL).
- (−) Hơi nặng so với quy mô, nhưng chi phí thấp so với rủi ro sai tiền/kho/điểm.

## Phương án đã cân nhắc

Chỉ kiểm tra trạng thái ở tầng ứng dụng (race condition); khóa phân tán Redis (thêm hạ tầng không cần thiết).
