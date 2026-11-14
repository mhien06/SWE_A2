# ADR-008: Sổ cái điểm BrewLite, hoàn và bù điểm

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-14
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), `docs/requirements/context-and-scope.md`

## Context

- Điểm được cộng một lần sau `PAID`, dùng để giảm giá, và dùng để bù giá trị VNPay khi hủy hợp lệ (1 điểm = 100 VNĐ, làm tròn lên).
- Điểm bù là quyền lợi trong BrewLite, không phải tiền hoàn VNPay; phải tránh bù/hoàn trùng, kể cả với yêu cầu hoàn tiền VNPay cũ.

## Decision

1. Điểm quản lý bằng **sổ cái bất biến** `LoyaltyTransaction` với loại: `EARN`, `REDEEM`, `EARN_REVERSAL`, `REDEEM_REVERSAL`, `COMPENSATION`; số dư là tổng sổ cái (có thể lưu bản sao số dư trong `User`, cập nhật cùng transaction).
2. Unique `(orderId, type)` cho `EARN`/`REDEEM`/reversal và unique `(paymentId, COMPENSATION)` để mỗi hiệu ứng chỉ xảy ra một lần.
3. `COMPENSATION = ceil(số tiền VNPay đã trả / 100)`, dựa trên tiền thanh toán thực, không gồm phần đã giảm bằng điểm (phần đó được trả bằng `REDEEM_REVERSAL`).
4. Công thức cộng điểm thông thường nằm trong **một hàm** của `LoyaltyModule`, nhóm chốt trong SRS.
5. Khóa đối chiếu theo `paymentId` để phát hiện yêu cầu hoàn tiền VNPay cũ và ngăn bù hai lần.

## Consequences

- (+) Có thể kiểm toán toàn bộ biến động điểm; đảo ngược thao tác không làm mất lịch sử.
- (+) Quy tắc bù/hoàn rõ ràng, test được.
- (−) Cần quyết định số dư điểm âm khi khách đã tiêu số điểm vừa được cộng (chưa chốt).
- (−) Bản sao số dư phải đồng bộ với sổ cái trong cùng transaction.

## Phương án đã cân nhắc

Chỉ lưu số dư (mất dấu vết, khó chống trùng); hoàn tiền VNPay tự động (ngoài phạm vi Task 1.1).
