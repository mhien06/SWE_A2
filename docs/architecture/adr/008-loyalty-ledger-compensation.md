# ADR-008: Sổ cái điểm BrewLite, hoàn và bù điểm, loại trừ refund VNPay cũ

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-15
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), [SRS](../../requirements/srs.md), [Domain Class](../../diagrams/domain-class.md), [Sequence](../../diagrams/sequence-checkout.md)

## Context

- Điểm: `EARN` khi `PAID`, `REDEEM` để giảm giá, hoàn/thu hồi khi hủy, và `VNPAY_COMPENSATION` để bù giá trị VNPay (`ceil(VNPay thực trả / 100)`, 1 điểm = 100 VNĐ chỉ áp dụng cho điểm bù) (FR-18, FR-19, BR-08, BR-10).
- Điểm bù không phải tiền hoàn VNPay; mỗi Payment chỉ nhận **một** quyền lợi: refund VNPay cũ **hoặc** điểm bù (FR-20, BR-09).

## Decision

1. Điểm quản lý bằng **sổ cái** `LoyaltyTransaction`, không xóa lịch sử, các loại: `EARN`, `REDEEM`, `RETURN_REDEEMED`, `REVERSE_EARNED`, `VNPAY_COMPENSATION`, `ADJUST`. `User.pointsBalance` cập nhật cùng transaction với ledger.
2. Mỗi giao dịch điểm có `idempotencyKey` unique; unique `(paymentId, VNPAY_COMPENSATION)`.
3. `EARN` tính theo chính sách trên tiền VNPay thực trả, không trên phần giảm bằng điểm; tỷ lệ chưa chốt, đóng gói trong một hàm của `LoyaltyModule`.
4. Khi hủy `PAID` hợp lệ: `RETURN_REDEEMED` + `REVERSE_EARNED` + (nếu qua kiểm tra) `VNPAY_COMPENSATION`. Khi hủy đơn chưa trả: chỉ `RETURN_REDEEMED`.
5. Trước khi bù, tra `VNPayRefundRecord`: `PENDING`/`UNKNOWN` → khóa bù và đối soát; `SUCCEEDED` hoặc đã bù → không cấp trùng; không có → bù. Refund `FAILED`: chưa quy định, chờ nhóm chốt.
6. Áp dụng cùng quy tắc bù cho thanh toán đến muộn (đơn `CANCELLED`) và thiếu nguyên liệu (`PAYMENT_EXCEPTION`).

## Consequences

- (+) Kiểm toán được mọi biến động điểm; đảo ngược không mất lịch sử.
- (+) Quy tắc bù/hoàn rõ ràng, test được (FR-19 ví dụ 29.050đ → 291 điểm).
- (−) Cần quyết định `pointsBalance` có được âm khi thu hồi `EARN` đã tiêu (chưa chốt).
- (−) Bản sao số dư phải đồng bộ với ledger trong cùng transaction.

## Phương án đã cân nhắc

Chỉ lưu số dư (mất dấu vết, khó chống trùng); VNPay Refund tự động (ngoài phạm vi Task 1.1, SRS §7).
