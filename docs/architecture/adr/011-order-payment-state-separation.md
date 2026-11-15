# ADR-011: Tách trạng thái Order và Payment; dùng PAYMENT_EXCEPTION cho thiếu nguyên liệu

- **Trạng thái:** Đề xuất (chờ review của Nguyễn Minh Hiển)
- **Ngày:** 2026-11-15
- **Người đề xuất:** Trần Đăng Khoa
- **Liên quan:** [`architecture.md`](../architecture.md), [SRS](../../requirements/srs.md), [Domain Class](../../diagrams/domain-class.md), [Sequence](../../diagrams/sequence-checkout.md)

## Context

- SRS BR-13 và Domain Class yêu cầu hai vòng đời riêng: `OrderStatus` và `PaymentStatus`; Order không có thuộc tính trạng thái thanh toán riêng.
- Cần biểu diễn "VNPay đã thu tiền nhưng không đủ nguyên liệu" mà không ghi `PAID` sai (BR-12).
- Cần biểu diễn thanh toán đến muộn sau khi đơn đã `CANCELLED` mà không mở lại đơn (BR-11).

## Decision

1. `Order.status`: `PENDING`, `PAYMENT_FAILED`, `PAYMENT_EXCEPTION`, `PAID`, `PREPARING`, `READY_FOR_PICKUP`, `COMPLETED`, `CANCELLED`. `Payment.status`: `PENDING`, `SUCCEEDED`, `FAILED`, `UNKNOWN`, `EXPIRED`. Hai enum tách biệt.
2. Kết quả giao dịch chỉ lưu ở `Payment.status`; Order chỉ phản ánh tiến trình nghiệp vụ.
3. Thiếu nguyên liệu: Payment `SUCCEEDED`, Order `PAYMENT_EXCEPTION`; không trừ kho, không `EARN`; bù điểm theo ADR-008. Order giữ `PAYMENT_EXCEPTION` sau khi bù, không tự hủy, không sang `PREPARING`.
4. Thanh toán đến muộn: Payment `SUCCEEDED` + ngoại lệ ghi vào `payment_event`; Order giữ `CANCELLED`.
5. State machine nằm trong `OrderModule`; mọi chuyển trạng thái trong TX có khóa dòng.

## Consequences

- (+) Không trộn vòng đời; dữ liệu đối soát rõ ràng, không mất bằng chứng đã thu tiền.
- (+) Khớp Domain Class và Sequence, dễ truy vết.
- (−) Thêm trạng thái `PAYMENT_EXCEPTION` (đã chốt ở Domain Class), cần quy ước hiển thị cho khách và hướng dẫn vận hành đối soát.
- (−) Cần quy ước hiển thị cho khách ở từng tổ hợp trạng thái.

## Phương án đã cân nhắc

Một enum chung cho đơn và thanh toán (trộn hai vòng đời); hủy tự động đơn thiếu nguyên liệu (Domain Class không tự suy diễn chuyển sang `CANCELLED`).
