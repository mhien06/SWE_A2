# ADR-009: JWT và RBAC Customer/Staff/Manager

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-15
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), [SRS](../../requirements/srs.md), [Domain Class](../../diagrams/domain-class.md), [Sequence](../../diagrams/sequence-checkout.md)

## Context

- FR-04 yêu cầu đăng ký, đăng nhập, JWT và phân quyền Customer/Staff/Manager; NFR-02 yêu cầu kiểm tra quyền phía server và sở hữu đơn.
- Manager được dùng các chức năng vận hành của Staff (SRS §6).
- API không giữ session phía server để dễ chạy nhiều bản.

## Decision

1. Mật khẩu băm (bcrypt hoặc argon2), chỉ lưu `passwordHash`; không log mật khẩu.
2. Access token JWT ký bằng `JWT_SECRET`, thời hạn ngắn (`JWT_EXPIRES_IN`), chứa `sub` và `role`.
3. Web App gửi token qua `Authorization: Bearer`.
4. `JwtAuthGuard` + `RolesGuard` (`@Roles()`): Customer, Staff, Manager (Manager kế thừa quyền Staff); `UserStatus = INACTIVE` bị từ chối.
5. Kiểm tra **sở hữu đơn** ở Service: Customer chỉ xem/hủy đơn của mình.
6. `ValidationPipe` (whitelist, từ chối trường lạ).
7. Cách Web App lưu token (bộ nhớ hay cookie `HttpOnly`) là quyết định hiện thực ở Task 5, cân nhắc XSS/CSRF; cập nhật ADR này khi chốt.

## Consequences

- (+) API không trạng thái, dễ mở rộng ngang; RBAC khai báo rõ trên từng endpoint.
- (−) Thu hồi token trước hạn khó; giảm bằng thời hạn ngắn (có thể thêm refresh token sau).
- (−) Lưu token ở client có rủi ro XSS/CSRF tùy cách chọn.

## Phương án đã cân nhắc

Session phía server (cần lưu trữ chung khi nhiều bản API); OAuth bên thứ ba (ngoài phạm vi).
