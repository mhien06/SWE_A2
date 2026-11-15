# ADR-004: Tích hợp VNPay Sandbox qua một adapter; tin IPN/QueryDR, không tin Return URL

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-15
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), [SRS](../../requirements/srs.md), [Domain Class](../../diagrams/domain-class.md), [Sequence](../../diagrams/sequence-checkout.md)

## Context

- VNPay Sandbox là hệ thống ngoài, nằm ngoài ranh giới BrewLite, chỉ thử nghiệm; BR-01 chỉ cho phép VNPay Sandbox.
- Return URL đi qua trình duyệt nên có thể bị giả mạo hoặc không được gọi; IPN có thể gửi lặp/đến muộn; có thể phát sinh giao dịch `UNKNOWN` (FR-09, BR-04).

## Decision

1. Toàn bộ giao tiếp VNPay nằm trong `PaymentModule` qua `VNPayGateway` (ký URL HMAC, xác minh chữ ký, gọi QueryDR). Module khác không biết chi tiết VNPay.
2. Kết quả chỉ được công nhận khi **xác minh chữ ký, `transactionRef`, số tiền (= `vnpayPayableAmount`), mã kết quả**.
3. **Return URL chỉ để hiển thị**: không đổi trạng thái Order/Payment; Web App đọc trạng thái từ API.
4. Mỗi lần thanh toán là một `Payment` (attempt) với `transactionRef` duy nhất, `idempotencyKey`, `expiresAt ≤ Order.expiresAt`; trạng thái `PENDING`, `SUCCEEDED`, `FAILED`, `UNKNOWN`, `EXPIRED`.
5. IPN và QueryDR dùng **chung một hàm giao dịch xử lý kết quả thanh toán** (ADR-006); QueryDR gọi ngoài transaction giữ khóa.
6. Sự kiện IPN/QueryDR ghi vào `payment_event`; không lưu số thẻ, CVV hay thông tin ngân hàng.
7. `VNP_HASH_SECRET`, `VNP_TMN_CODE` chỉ đọc từ biến môi trường.

## Consequences

- (+) Đổi/giả lập cổng thanh toán chỉ ảnh hưởng một adapter; dễ mock khi test.
- (+) Chống giả mạo kết quả và xử lý đúng `UNKNOWN`.
- (−) Khách có thể thấy "đang xác minh" một lúc; cần polling/refresh.
- (−) Phụ thuộc VNPay Sandbox ổn định; IPN cần URL công khai khi demo (xem Task 3.2).

## Phương án đã cân nhắc

Tin Return URL để cập nhật đơn nhanh (không an toàn, vi phạm FR-09); tích hợp VNPay rải rác trong Order (khó kiểm thử, vi phạm ranh giới).
