# ADR-001: Dùng monorepo cho Web, API và tài liệu

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-14
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), `docs/requirements/context-and-scope.md`

## Context

- Đề bài Assignment 2 yêu cầu một repository có `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows`.
- Nhóm 6 người, thay đổi thường chạm đồng thời giao diện, API và tài liệu; cần truy vết yêu cầu → thiết kế → code → test trong cùng lịch sử commit/PR.
- CI/CD cần một nơi để chạy lint, test, build cho cả hai ứng dụng.

## Decision

Dùng **một repository (monorepo)** với cấu trúc:

```text
apps/web   # Next.js PWA
apps/api   # NestJS
docs       # requirements, diagrams, architecture (ADR)
tests      # integration / E2E
.github/workflows
```

Mỗi ứng dụng có `package.json`, lint, test và build riêng. Chưa tạo package dùng chung; nếu cần chia sẻ kiểu dữ liệu, bổ sung ADR mới.

## Consequences

- (+) Một PR có thể chứa thay đổi code, sơ đồ và tài liệu cùng nhau; ma trận truy vết dễ duy trì.
- (+) CI cấu hình một lần, dùng `paths` filter để chỉ chạy phần bị ảnh hưởng.
- (−) Repo lớn dần; CI phải tránh chạy thừa.
- (−) Quyền truy cập không tách được theo ứng dụng (không cần với phạm vi bài tập).

## Phương án đã cân nhắc

Hai repo riêng cho web và API (khó truy vết, hai bộ PR, tách lịch sử tài liệu); monorepo có công cụ build chuyên dụng (Nx/Turborepo) – thừa so với quy mô hiện tại.
