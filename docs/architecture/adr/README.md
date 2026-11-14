# Architecture Decision Records (ADR)

Mỗi ADR có các phần **Context**, **Decision**, **Consequences**. Thay đổi quyết định bằng một ADR mới (hoặc cập nhật trạng thái) qua pull request, ghi rõ lý do.

| ADR | Tiêu đề | Trạng thái |
|---|---|---|
| [001](001-monorepo.md) | Dùng monorepo cho Web, API và tài liệu | Đề xuất |
| [002](002-modular-monolith-nestjs.md) | NestJS modular monolith theo domain, kiến trúc phân lớp | Đề xuất |
| [003](003-postgresql-prisma-migrations.md) | PostgreSQL làm nguồn dữ liệu duy nhất, Prisma Migrate, tiền lưu số nguyên | Đề xuất |
| [004](004-vnpay-sandbox-integration.md) | Tích hợp VNPay Sandbox qua một adapter; tin IPN và truy vấn giao dịch, không tin Return URL | Đề xuất |
| [005](005-idempotency-and-duplicate-control.md) | Idempotency nhiều lớp và kiểm soát xử lý trùng | Đề xuất |
| [006](006-transactions-inventory-loyalty.md) | Một transaction cho thanh toán thành công, trừ kho, tích điểm và hủy đơn | Đề xuất |
| [007](007-scheduler-expiry-reconciliation.md) | Scheduler hết hạn đơn PENDING 15 phút và đối soát VNPay | Đề xuất |
| [008](008-loyalty-ledger-compensation.md) | Sổ cái điểm BrewLite, hoàn và bù điểm | Đề xuất |
| [009](009-jwt-authentication-rbac.md) | JWT và RBAC Customer/Staff/Manager | Đề xuất |
| [010](010-config-logging-health.md) | Quản lý cấu hình/secret, logging và health check | Đề xuất |
