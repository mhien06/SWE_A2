# ADR-003: PostgreSQL là nguồn dữ liệu duy nhất, Prisma Migrate, tiền lưu số nguyên

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-15
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), [SRS](../../requirements/srs.md), [Domain Class](../../diagrams/domain-class.md), [Sequence](../../diagrams/sequence-checkout.md)

## Context

- Đề bài bắt buộc PostgreSQL; NFR-06 yêu cầu migration/seed tái tạo được database.
- Cần transaction, khóa dòng và ràng buộc unique/CHECK để chống xử lý trùng và sai tồn kho (NFR-04).
- Cần migration chạy được trong pipeline và rollback an toàn.

## Decision

- PostgreSQL là nguồn dữ liệu duy nhất; không có cache hay hàng đợi làm nguồn sự thật.
- ORM và migration: **Prisma** (`prisma migrate`); file migration commit trong `apps/api/prisma/`; seed chạy lại được.
- **Bảng nghiệp vụ** theo đúng 15 class MVP của Domain Class: `User`, `Cart`, `CartItem`, `Product`, `ProductOption`, `Ingredient`, `Recipe`, `RecipeIngredient`, `Order`, `OrderItem`, `OrderIngredientUsage`, `Payment`, `OrderCancellation`, `VNPayRefundRecord`, `LoyaltyTransaction`. `Promotion` (`«future»`) chưa có bảng.
- **Bảng kỹ thuật [Đề xuất]:** `payment_event` (nhật ký IPN/QueryDR và ngoại lệ) cho FR-26; không thuộc domain model.
- Tiền VND là **số nguyên**; số lượng nguyên liệu kiểu thập phân; thời gian UTC.
- Ràng buộc DB (`UNIQUE` các `idempotencyKey` và `transactionRef`, `CHECK quantityOnHand >= 0`, `CHECK quantityRestored <= quantityDeducted`, khóa ngoại) là lớp bảo vệ cuối.
- Migration tương thích ngược một phiên bản (expand → migrate → contract); chạy bằng bước riêng trước khi khởi động bản API mới.

## Consequences

- (+) Nhất quán mạnh; ràng buộc DB bảo vệ khi code có lỗi.
- (+) Migration có lịch sử, tái tạo database ở local, CI và production.
- (−) Prisma hạn chế với `FOR UPDATE`/`SKIP LOCKED` nên dùng `$queryRaw` ở các điểm đó.
- (−) Bước "contract" của migration phải tách bản phát hành riêng để không phá rollback.
- *Ghi chú:* nếu nhóm đã chọn ORM khác (TypeORM…), thay phần công cụ; các nguyên tắc còn lại giữ nguyên.

## Phương án đã cân nhắc

MongoDB (không phù hợp quan hệ và ràng buộc); TypeORM/SQL thuần (không loại trừ; Prisma được chọn vì schema-first và migration rõ ràng).
