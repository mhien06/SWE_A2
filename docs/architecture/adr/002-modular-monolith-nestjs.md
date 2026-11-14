# ADR-002: NestJS modular monolith theo domain, kiến trúc phân lớp

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-15
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), [SRS](../../requirements/srs.md), [Domain Class](../../diagrams/domain-class.md), [Sequence](../../diagrams/sequence-checkout.md)

## Context

- Nghiệp vụ cốt lõi (TX2: ghi `PAID`, trừ nguyên liệu, `EARN`) cần tính nguyên tử và nhất quán mạnh (FR-10, NFR-04).
- Nhóm nhỏ, thời gian hạn chế; hạ tầng triển khai phải đơn giản.
- Cần ranh giới rõ để phân công và kiểm thử độc lập (NFR-06).

## Decision

Backend là **một ứng dụng NestJS** (modular monolith), chia module theo domain: Auth, Product, Cart, Order, Payment, Inventory, Loyalty, Scheduler (+ cross-cutting: config, logger, filter, guard, health). `PromotionModule` là `«future»`, chưa thuộc MVP (SRS không có FR khuyến mãi).

Trong mỗi module: Controller → Service → Persistence. Module chỉ gọi module khác qua Service được export, không truy cập bảng của module khác. `OrderModule` điều phối TX1/TX3; `PaymentModule` điều phối TX2.

## Consequences

- (+) Transaction ACID xuyên Order–Inventory–Loyalty trong một tiến trình, không cần saga/outbox.
- (+) Một image Docker, một pipeline triển khai.
- (+) Module hóa giúp test từng phần và tách service sau này nếu cần.
- (−) Không scale riêng từng module; lỗi nặng ở một module ảnh hưởng cả API.
- (−) Cần kỷ luật tránh phụ thuộc vòng; kiểm tra khi review.

## Phương án đã cân nhắc

Microservices (cần giao dịch phân tán, quá tải cho nhóm 6 người); monolith không chia module (khó phân công và kiểm thử).
