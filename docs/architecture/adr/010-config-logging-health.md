# ADR-010: Quản lý cấu hình/secret, logging và health check

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-14
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), `docs/requirements/context-and-scope.md`

## Context

- Cùng một image phải chạy được ở local, CI và production chỉ bằng đổi cấu hình.
- Secret không được xuất hiện trong repository hoặc log CI.
- Pipeline cần smoke test sau triển khai; nền tảng cần kiểm tra sức khỏe dịch vụ.

## Decision

1. **Cấu hình:** biến môi trường, đọc qua `ConfigModule`, validate lúc khởi động (dừng nếu thiếu/sai). `.env.example` chỉ chứa tên biến và giá trị minh họa.
2. **Secret:** lưu trong secret store của CI và nền tảng; không commit, không in ra log; che trường nhạy cảm khi log.
3. **Logging:** Pino, JSON ra stdout, có `correlationId` cho mỗi request; log sự kiện nghiệp vụ quan trọng (đổi trạng thái, IPN, đối soát, hoàn kho, bù điểm).
4. **Health:** `GET /health` (liveness, không phụ thuộc DB) và `GET /health/ready` (kiểm tra PostgreSQL) bằng `@nestjs/terminus`; dùng cho smoke test.
5. **CORS/HTTPS:** CORS giới hạn `WEB_ORIGIN`; HTTPS bắt buộc ở production (chi tiết ở Task 3.2).

## Consequences

- (+) Một image, nhiều môi trường; lỗi cấu hình phát hiện ngay lúc khởi động.
- (+) Log truy vết được xuyên suốt một yêu cầu, hỗ trợ đối soát thanh toán.
- (−) Nhiều biến môi trường cần tài liệu hóa (`README`, `.env.example`).
- (−) Log JSON khó đọc khi chạy local; có thể dùng bộ định dạng đẹp ở môi trường dev.
- *Ghi chú:* nếu nhóm chọn thư viện logger khác Pino, chỉ cần cập nhật mục 3.

## Phương án đã cân nhắc

Cấu hình trong file commit vào repo (lộ secret); log văn bản thuần không correlation-id (khó truy vết).
