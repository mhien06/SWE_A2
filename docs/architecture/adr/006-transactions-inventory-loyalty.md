# ADR-006: TX1/TX2/TX3: transaction cho tạo đơn, thanh toán, trừ kho, tích điểm và hủy đơn

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-15
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), [SRS](../../requirements/srs.md), [Domain Class](../../diagrams/domain-class.md), [Sequence](../../diagrams/sequence-checkout.md)

## Context

- Thanh toán thành công phải ghi `PAID`, trừ nguyên liệu và `EARN` đúng một lần; không có `PAID` nửa chừng (FR-10, E10).
- Hủy hợp lệ phải hoàn đúng lượng đã trừ một lần và điều chỉnh/bù điểm (FR-17–FR-19).
- Thanh toán thành công đến muộn hoặc thiếu nguyên liệu là tình huống có thật (BR-11, BR-12).

## Decision

Dùng ba transaction, đặt tên như tài liệu Sequence:

1. **TX1 – Tạo đơn** (`OrderModule`): `Order(PENDING)` + `OrderItem` snapshot + `expiresAt`; ghi `REDEEM` nếu dùng điểm; không trừ/giữ nguyên liệu. *[Đề xuất]* `REDEEM` ghi ở TX1.
2. **TX2 – Kết quả thanh toán** (`PaymentModule` điều phối): khóa Order, Payment, Ingredient, điểm; một trong các nhánh: lặp (không đổi), `FAILED` (Order `PAYMENT_FAILED` nếu còn chờ), `SUCCEEDED` + Order `CANCELLED` (ghi ngoại lệ đến muộn, giữ `CANCELLED`), `SUCCEEDED` + thiếu nguyên liệu (Order `PAYMENT_EXCEPTION`), `SUCCEEDED` hợp lệ (Order `PAID`, trừ kho + `OrderIngredientUsage`, `EARN`).
3. **TX3 – Hủy đơn** (`OrderModule`): kiểm quyền, `OrderCancellation`, hoàn theo `quantityDeducted` đã lưu, `RETURN_REDEEMED`/`REVERSE_EARNED`, kiểm tra `VNPayRefundRecord` rồi `VNPAY_COMPENSATION`.

Quy tắc chung: lỗi ghi/commit → rollback toàn bộ, không trả thành công, retry an toàn bằng khóa nghiệp vụ; trừ kho có điều kiện `quantityOnHand >= :q`; khóa dòng Order trước khi kiểm tra điều kiện, nên hủy và bắt đầu pha đồng thời chỉ một bên thắng. Mức cô lập `READ COMMITTED` + khóa dòng + ràng buộc unique, không cần `SERIALIZABLE`.

## Consequences

- (+) Không bao giờ có trạng thái nửa vời (`PAID` mà chưa trừ kho, hoặc ngược lại).
- (+) Sổ cái/usage cho phép kiểm toán và chứng minh "đúng một lần".
- (−) Giữ khóa dòng Order trong thời gian TX; chấp nhận vì mỗi đơn xử lý nhanh, ít cạnh tranh.
- (−) `PAYMENT_EXCEPTION` và nhánh thanh toán đến muộn đã được Task 1–2 chốt (BR-11, BR-12, Domain Class §5, §11). Chỉ thời điểm ghi `REDEEM` ở TX1 và công thức `vnpayPayableAmount` còn là đề xuất cần nhóm xác nhận.

## Phương án đã cân nhắc

Saga/sự kiện bất đồng bộ (không cần khi cùng một DB); `SERIALIZABLE` toàn cục (giảm thông lượng, khó retry).
