# ADR-003: PostgreSQL làm nguồn dữ liệu duy nhất, Prisma Migrate, tiền lưu số nguyên

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-14
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), `docs/requirements/context-and-scope.md`

## Context

- Đề bài bắt buộc PostgreSQL; yêu cầu migration/seed tái tạo được database.
- Cần transaction, khóa dòng và ràng buộc unique/CHECK để chống xử lý trùng và sai tồn kho.
- Cần migration chạy được trong pipeline và rollback an toàn.

## Decision

- PostgreSQL là nguồn dữ liệu duy nhất; không có cache hay hàng đợi làm nguồn sự thật.
- ORM và migration: **Prisma** (`prisma migrate`), file migration được commit trong `apps/api/prisma/`; seed bằng script có thể chạy lại.
- Tiền VND lưu **số nguyên (đồng)**; thời gian lưu UTC.
- Dùng ràng buộc DB (`UNIQUE`, `CHECK stock >= 0`, khóa ngoại) làm lớp bảo vệ cuối cùng.
- Migration theo hướng tương thích ngược một phiên bản (expand → migrate → contract); chạy bằng bước riêng trước khi khởi động bản API mới.

## Consequences

- (+) Tính nhất quán mạnh, ràng buộc DB bảo vệ khi code có lỗi.
- (+) Migration có lịch sử, tái tạo database ở local, CI và production.
- (−) Prisma hạn chế với một số truy vấn khóa (`FOR UPDATE`, `SKIP LOCKED`) nên phải dùng `$queryRaw` ở các điểm đó.
- (−) Migration "contract" phải tách bản phát hành riêng để không phá rollback.
- *Ghi chú:* nếu nhóm đã chọn ORM khác (TypeORM…), thay ADR này bằng bản cập nhật; các nguyên tắc còn lại giữ nguyên.

## Phương án đã cân nhắc

MongoDB (không phù hợp quan hệ và ràng buộc); TypeORM/SQL thuần (không loại trừ, Prisma được chọn vì schema-first và migration rõ ràng; nhóm có thể thay nếu đã thống nhất công cụ khác).
