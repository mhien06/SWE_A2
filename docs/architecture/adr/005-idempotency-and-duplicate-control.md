# ADR-005: Idempotency nhiều lớp, khóa nằm trên thực thể

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-15
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), [SRS](../../requirements/srs.md), [Domain Class](../../diagrams/domain-class.md), [Sequence](../../diagrams/sequence-checkout.md)

## Context

- Client gửi lại yêu cầu; VNPay gửi IPN lặp; Scheduler và IPN có thể xử lý cùng một đơn; hủy, thanh toán, bắt đầu pha có thể đồng thời (FR-12, BR-09, E11).
- Sai sót dẫn đến trừ kho hai lần, cộng/bù điểm nhiều lần hoặc hai lượt thanh toán cạnh tranh.

## Decision

Áp dụng các lớp độc lập (chi tiết ở `architecture.md` mục 6.3), dùng **đúng các trường đã có trong Domain Class**:

1. **Tạo Payment attempt:** `Idempotency-Key` lưu ở `Payment.idempotencyKey` (unique) cùng hash nội dung. Cùng key + cùng nội dung → trả kết quả cũ, không tạo attempt mới; cùng key khác nội dung → từ chối (`409`).
2. **Điều kiện tạo attempt mới:** Order còn hạn và mọi attempt trước đã `FAILED`/`EXPIRED`; có attempt `PENDING`/`UNKNOWN` thì không tạo ("Đang xác minh").
3. **Giao dịch:** `Payment.transactionRef` unique; IPN/QueryDR lặp chỉ ACK, không đổi gì.
4. **Hủy:** `OrderCancellation.idempotencyKey`, mỗi Order tối đa một `OrderCancellation`.
5. **Hoàn kho:** `OrderIngredientUsage.restoreIdempotencyKey`, `quantityRestored ≤ quantityDeducted`.
6. **Điểm:** `LoyaltyTransaction.idempotencyKey` unique; unique `(paymentId, VNPAY_COMPENSATION)`.
7. **Đồng thời:** `SELECT … FOR UPDATE` Order/Payment trong TX; chỉ một chuyển trạng thái hợp lệ thắng.

Mọi đường xử lý kết quả thanh toán (IPN, QueryDR, đối soát) dùng chung một hàm.

## Consequences

- (+) Kết quả đúng ngay cả khi tầng ứng dụng có lỗi hoặc có nhiều bản API chạy song song.
- (+) Test được bằng cách gửi lặp cùng IPN/yêu cầu (TC-1.3-08, TC-1.3-09).
- (−) Nhiều ràng buộc và xử lý lỗi vi phạm unique.
- (−) `Order` không có `idempotencyKey` trong domain model nên `POST /orders` chưa được chống tạo trùng ở tầng DB; giảm thiểu bằng UI, và nhóm cần xem lại (architecture.md mục 11).

## Phương án đã cân nhắc

Chỉ kiểm tra trạng thái ở tầng ứng dụng (race condition); bảng `idempotency_key` chung (trùng lặp với các khóa đã có trên thực thể); khóa phân tán Redis (thêm hạ tầng không cần thiết).
