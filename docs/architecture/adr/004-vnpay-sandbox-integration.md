# ADR-004: Tích hợp VNPay Sandbox qua một adapter; tin IPN và truy vấn giao dịch, không tin Return URL

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-14
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), `docs/requirements/context-and-scope.md`

## Context

- VNPay Sandbox là hệ thống ngoài, nằm ngoài ranh giới BrewLite, chỉ thử nghiệm.
- Return URL đi qua trình duyệt nên có thể bị giả mạo hoặc không bao giờ được gọi; IPN có thể gửi trùng hoặc đến muộn; có thể phát sinh giao dịch UNKNOWN.

## Decision

1. Toàn bộ code giao tiếp VNPay nằm trong `PaymentModule` qua `VNPayGateway` (tạo URL ký HMAC-SHA512, xác minh chữ ký, gọi `querydr`). Module khác không biết chi tiết VNPay.
2. Kết quả thanh toán chỉ được chấp nhận khi **xác minh chữ ký, số tiền khớp đơn, `vnp_TxnRef` tồn tại** (từ IPN hoặc `querydr`).
3. **Return URL chỉ để hiển thị**: không đổi trạng thái đơn; Web App đọc trạng thái đơn từ API.
4. Mỗi lần thử thanh toán tạo một bản ghi `Payment` với `txnRef` duy nhất; IPN thô được lưu vào `payment_event`.
5. Trả mã phản hồi IPN theo đặc tả VNPay (thành công, đã xác nhận, sai số tiền, sai chữ ký…).
6. Secret (`VNP_HASH_SECRET`, `VNP_TMN_CODE`) chỉ đọc từ biến môi trường.

## Consequences

- (+) Đổi/giả lập cổng thanh toán chỉ ảnh hưởng một adapter; dễ mock khi test.
- (+) Chống giả mạo kết quả thanh toán và xử lý đúng trường hợp UNKNOWN.
- (−) Người dùng có thể thấy trạng thái "đang xác nhận" trong thời gian ngắn; cần polling/refresh.
- (−) Phụ thuộc VNPay Sandbox ổn định; cần cấu hình URL IPN công khai khi demo (xem Task 3.2).

## Phương án đã cân nhắc

Tin Return URL để cập nhật đơn nhanh (không an toàn); tích hợp VNPay rải rác trong Order (khó kiểm thử, vi phạm ranh giới).
