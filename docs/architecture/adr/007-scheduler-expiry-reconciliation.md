# ADR-007: Scheduler: hết hạn 15 phút và đối soát QueryDR

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-15
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), [SRS](../../requirements/srs.md), [Domain Class](../../diagrams/domain-class.md), [Sequence](../../diagrams/sequence-checkout.md)

## Context

- Order chờ tối đa 15 phút từ `createdAt`; `Payment.expiresAt ≤ Order.expiresAt`; thanh toán lại không gia hạn (FR-07, BR-03).
- Có thể hết hạn khi VNPay chưa trả kết quả rõ ràng; hủy nhầm đơn đã thu tiền là lỗi nghiêm trọng (FR-13, BR-04, E07).
- `PAID` không tự hủy theo hạn; `PAYMENT_EXCEPTION` không tự hủy.
- API có thể chạy nhiều bản.

## Decision

1. `SchedulerModule` (`@nestjs/schedule`) trong API, hai nhiệm vụ: **đối soát Payment chưa rõ** và **tự hủy Order chưa thanh toán hết hạn** (mỗi phút).
2. `Order.expiresAt = createdAt + ORDER_PENDING_TTL_MINUTES` (mặc định 15) theo đồng hồ server; `Payment.expiresAt` cấu hình bằng `PAYMENT_ATTEMPT_TTL_MINUTES`, không vượt hạn Order.
3. Đối soát: đọc Payment `PENDING`/`UNKNOWN`, gọi **QueryDR ngoài transaction giữ khóa**, xác minh rồi áp dụng **cùng TX2** như IPN; chưa rõ thì giữ `UNKNOWN`, hẹn lại với backoff; attempt quá hạn đã xác minh không thành công → `EXPIRED`.
4. Tự hủy: chọn Order `PENDING`/`PAYMENT_FAILED` quá hạn bằng `FOR UPDATE SKIP LOCKED` theo lô; đối soát trước; khóa và kiểm tra lại; **chỉ hủy khi không có `SUCCEEDED` và không còn `PENDING`/`UNKNOWN`**: `CANCELLED` + `OrderCancellation(isAutomatic = true)`, `RETURN_REDEEMED`, không hoàn kho.
5. Không tự hủy `PAID`/`PAYMENT_EXCEPTION`; không tạo Payment mới sau hạn Order.
6. *[Đề xuất]* quá ngưỡng thử lại QueryDR thì đánh dấu cần kiểm tra thủ công; ngưỡng do nhóm chốt.

## Consequences

- (+) Dọn đơn hết hạn tự động mà không hủy nhầm đơn đã trả tiền.
- (+) Tách worker sau này chỉ cần chuyển module, không đổi logic.
- (−) Độ trễ hủy khoảng 1 phút sau hạn; chấp nhận được.
- (−) Cron chia sẻ tài nguyên với request; cần giới hạn kích thước lô.

## Phương án đã cân nhắc

Delay job bằng Redis/BullMQ (thêm hạ tầng); hủy ngay khi hết 15 phút không đối soát (hủy mù, vi phạm FR-13); chỉ dựa vào IPN (mất IPN thì kẹt đơn).
