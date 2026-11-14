# ADR-001: Dùng monorepo cho Web, API và tài liệu

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-15
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), [SRS](../../requirements/srs.md), [Domain Class](../../diagrams/domain-class.md), [Sequence](../../diagrams/sequence-checkout.md)

## Context

- Đề bài Assignment 2 yêu cầu một repository có `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows`.
- Thay đổi thường chạm đồng thời giao diện, API và tài liệu; cần truy vết yêu cầu → thiết kế → code → test (NFR-10) trong cùng lịch sử commit/PR.
- CI/CD cần một nơi chạy lint, test, build cho cả hai ứng dụng.

## Decision

Dùng **một repository (monorepo)**:

```text
apps/web   # Next.js PWA
apps/api   # NestJS
docs       # requirements, diagrams, architecture (ADR)
tests      # integration / E2E
tools      # script hỗ trợ tài liệu (render sơ đồ)
.github/workflows
```

Mỗi ứng dụng có `package.json`, lint, test, build riêng. Chưa tạo package dùng chung; nếu cần chia sẻ kiểu dữ liệu, bổ sung ADR mới.

## Consequences

- (+) Một PR chứa được code, sơ đồ và tài liệu; ma trận truy vết dễ duy trì.
- (+) CI cấu hình một lần, dùng `paths` filter để chạy phần bị ảnh hưởng.
- (−) Repo lớn dần; CI phải tránh chạy thừa.
- (−) Không tách quyền theo ứng dụng (không cần ở phạm vi bài tập).

## Phương án đã cân nhắc

Hai repo riêng cho web và API (khó truy vết, hai bộ PR); monorepo có công cụ build chuyên dụng (Nx/Turborepo) – thừa so với quy mô hiện tại.
