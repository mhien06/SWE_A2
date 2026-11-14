# ADR-007: Scheduler hết hạn đơn PENDING 15 phút và đối soát VNPay

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-14
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), `docs/requirements/context-and-scope.md`

## Context

- Đơn `PENDING` chỉ chờ tối đa 15 phút từ lúc tạo (không phải từng URL thanh toán).
- Có thể hết hạn trong lúc VNPay chưa trả kết quả rõ ràng; hủy nhầm đơn đã thu tiền là lỗi nghiêm trọng.
- API có thể chạy nhiều bản.

## Decision

1. `SchedulerModule` (`@nestjs/schedule`) chạy trong API với hai job: **hết hạn đơn** (mỗi phút) và **đối soát giao dịch UNKNOWN** (backoff).
2. `Order.expiresAt = createdAt + ORDER_PENDING_TTL_MINUTES` (mặc định 15) được lưu khi tạo đơn.
3. Chọn đơn quá hạn bằng `FOR UPDATE SKIP LOCKED` theo lô để nhiều bản API không xử lý trùng.
4. Đơn có giao dịch `INITIATED`/`UNKNOWN` thì gọi `querydr` **trước khi** quyết định hủy; chỉ hủy khi giao dịch xác nhận thất bại/không tồn tại hoặc đơn không có giao dịch.
5. Kết quả `querydr` đi qua cùng hàm xử lý như IPN (ADR-005).
6. Lỗi mạng: giữ `UNKNOWN`, thử lại; vượt ngưỡng thì đánh dấu cần kiểm tra thủ công.

## Consequences

- (+) Đơn hết hạn được dọn tự động mà không hủy nhầm đơn đã trả tiền.
- (+) Thêm tách worker sau này chỉ cần chuyển module, không đổi logic.
- (−) Độ trễ hủy tối đa khoảng 1 phút sau hạn; chấp nhận được.
- (−) Cron trong API chia sẻ tài nguyên với request; cần giới hạn kích thước lô.

## Phương án đã cân nhắc

Delay job bằng Redis/BullMQ (thêm hạ tầng); hủy ngay khi hết 15 phút không đối soát (rủi ro hủy nhầm); dựa hoàn toàn vào IPN (mất IPN thì kẹt đơn).
