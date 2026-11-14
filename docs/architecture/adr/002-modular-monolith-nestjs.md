# ADR-002: NestJS modular monolith theo domain, kiến trúc phân lớp

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-14
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), `docs/requirements/context-and-scope.md`

## Context

- Nghiệp vụ cốt lõi (thanh toán thành công → đổi trạng thái đơn, trừ kho, cộng điểm) cần tính nguyên tử và nhất quán mạnh.
- Nhóm nhỏ, thời gian hạn chế; hạ tầng triển khai và vận hành phải đơn giản.
- Cần ranh giới rõ để phân công và kiểm thử độc lập.

## Decision

Backend là **một ứng dụng NestJS** (modular monolith), chia module theo domain: Auth, Product, Cart, Promotion, Order, Payment, Inventory, Loyalty, Scheduler, Health (+ cross-cutting). Trong mỗi module áp dụng ba lớp Controller → Service → Persistence.

Quy tắc: module chỉ gọi module khác qua Service được export; không truy cập bảng của module khác; chỉ `OrderModule` điều phối transaction đa module.

## Consequences

- (+) Transaction ACID xuyên Order–Inventory–Loyalty trong một tiến trình, không cần saga hay outbox.
- (+) Một image Docker, một pipeline triển khai.
- (+) Module hóa giúp test từng phần và có thể tách thành service sau này.
- (−) Không scale riêng từng module; lỗi nặng ở một module có thể ảnh hưởng cả API.
- (−) Cần kỷ luật để module không phụ thuộc vòng; kiểm tra trong review.

## Phương án đã cân nhắc

Microservices (phức tạp, cần giao dịch phân tán, quá tải cho nhóm 6 người); monolith không chia module (khó phân công và kiểm thử).
