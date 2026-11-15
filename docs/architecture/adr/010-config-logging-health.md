# ADR-010: Quản lý cấu hình/secret, logging và health check

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-15
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), [SRS](../../requirements/srs.md), [Domain Class](../../diagrams/domain-class.md), [Sequence](../../diagrams/sequence-checkout.md)

## Context

- Cùng một image phải chạy ở local, CI và production chỉ bằng đổi cấu hình (NFR-07).
- Secret không được xuất hiện trong repository hoặc log CI (NFR-03).
- Cần tìm giao dịch lỗi theo order/payment (NFR-08, FR-26) và smoke test sau triển khai.

## Decision

1. **Cấu hình:** biến môi trường qua `ConfigModule`, validate lúc khởi động (thiếu/sai thì dừng). `.env.example` chỉ chứa tên biến và giá trị minh họa (gồm `ORDER_PENDING_TTL_MINUTES`, `PAYMENT_ATTEMPT_TTL_MINUTES`).
2. **Secret:** trong secret store của CI và nền tảng; không commit, không in ra log; che trường nhạy cảm.
3. **Logging:** Pino, JSON ra stdout, có `correlationId`; ghi sự kiện đổi trạng thái đơn, kết quả IPN/QueryDR, giao dịch xử lý thanh toán và hủy đơn, hoàn kho, `EARN`/`REDEEM`/bù điểm; tra cứu được theo Order/Payment. Bảng `payment_event` lưu vết bền vững các sự kiện thanh toán và ngoại lệ.
4. **Health:** `GET /health` (liveness, không phụ thuộc DB) và `GET /health/ready` (kiểm tra PostgreSQL) bằng `@nestjs/terminus`.
5. **CORS/HTTPS:** CORS giới hạn `WEB_ORIGIN`; HTTPS bắt buộc ở production (Task 3.2).

## Consequences

- (+) Một image, nhiều môi trường; lỗi cấu hình phát hiện ngay lúc khởi động.
- (+) Truy vết được xuyên suốt một yêu cầu, hỗ trợ đối soát thanh toán.
- (−) Nhiều biến môi trường cần tài liệu hóa (`README`, `.env.example`).
- (−) Log JSON khó đọc khi chạy local; dùng bộ định dạng đẹp ở môi trường dev.
- *Ghi chú:* nếu nhóm chọn logger khác Pino, chỉ cập nhật mục 3.

## Phương án đã cân nhắc

Cấu hình trong file commit vào repo (lộ secret); log văn bản thuần không correlation-id (khó truy vết).
