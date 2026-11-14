# ADR-006: Một transaction cho thanh toán thành công, trừ kho, tích điểm và hủy đơn

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-14
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), `docs/requirements/context-and-scope.md`

## Context

- Khi thanh toán thành công phải đổi đơn sang `PAID`, trừ nguyên liệu theo công thức và cộng điểm đúng một lần.
- Hủy đơn hợp lệ phải hoàn đúng lượng đã trừ một lần và điều chỉnh điểm.
- Thiếu nguyên liệu hoặc đơn đã hủy lúc IPN đến là tình huống có thật.

## Decision

1. `OrderModule` điều phối: `markPaid`, `cancel` mở **một transaction** gồm cập nhật đơn/giao dịch, `InventoryModule`, `LoyaltyModule`; lỗi thì rollback toàn bộ.
2. Trừ kho có điều kiện `stock >= qty` trong SQL; sổ cái `InventoryMovement` ghi `DEDUCT`/`RESTORE`; hoàn kho dựa trên chính các dòng `DEDUCT` của đơn (hoàn "lượng thực tế đã trừ").
3. Khóa dòng đơn trước khi kiểm tra điều kiện (hủy chỉ khi chưa `PREPARING`), để hủy và bắt đầu pha đồng thời chỉ một bên thắng.
4. **[Đề xuất]** IPN thành công đến muộn hoặc thiếu nguyên liệu: ghi giao dịch thành công, không chuyển đơn `PAID`/không trừ kho, hủy đơn với lý do và bù điểm (bảng ngoại lệ ở `architecture.md` mục 6.2).
5. Mức cô lập mặc định `READ COMMITTED` cộng với khóa dòng và ràng buộc unique, không cần `SERIALIZABLE`.

## Consequences

- (+) Không bao giờ có trạng thái nửa vời (đã `PAID` mà chưa trừ kho, hoặc ngược lại).
- (+) Sổ cái cho phép kiểm toán và chứng minh "đúng một lần".
- (−) Transaction dài hơn nên giữ khóa dòng đơn lâu hơn; chấp nhận vì mỗi đơn xử lý nhanh và ít cạnh tranh.
- (−) Quy tắc ngoại lệ (mục 4) cần nhóm xác nhận.

## Phương án đã cân nhắc

Saga/sự kiện bất đồng bộ giữa các module (không cần khi cùng một DB); `SERIALIZABLE` toàn cục (giảm thông lượng, khó retry).
