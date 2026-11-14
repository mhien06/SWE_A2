# ADR-009: JWT và RBAC Customer/Staff/Manager

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-14
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), `docs/requirements/context-and-scope.md`

## Context

- Đề bài yêu cầu đăng ký, đăng nhập, JWT; có ba nhóm người dùng với quyền khác nhau.
- API không giữ session phía server để dễ chạy nhiều bản.

## Decision

1. Mật khẩu băm bằng bcrypt (hoặc argon2); không lưu/ghi log mật khẩu.
2. Access token JWT ký bằng `JWT_SECRET`, thời hạn ngắn (`JWT_EXPIRES_IN`), chứa `sub` và `role`.
3. Web App gửi token qua `Authorization: Bearer`.
4. `JwtAuthGuard` + `RolesGuard` (decorator `@Roles()`); khách chỉ truy cập đơn của chính mình (kiểm tra sở hữu ở Service).
5. Validate đầu vào bằng `ValidationPipe` (whitelist, từ chối trường lạ).
6. Cách Web App lưu token phía client (bộ nhớ/cookie `HttpOnly`) là quyết định hiện thực ở Task 5, cân nhắc rủi ro XSS và CSRF; cập nhật ADR này khi chốt.

## Consequences

- (+) API không trạng thái, dễ mở rộng ngang; RBAC khai báo rõ trên từng endpoint.
- (−) Thu hồi token trước hạn khó; giảm thiểu bằng thời hạn ngắn (có thể bổ sung refresh token sau).
- (−) Lưu token ở client có rủi ro XSS/CSRF tùy cách chọn.

## Phương án đã cân nhắc

Session phía server (cần lưu trữ chung khi nhiều bản API); OAuth bên thứ ba (ngoài phạm vi).
