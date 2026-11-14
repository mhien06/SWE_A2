# Sequence Diagram – Đặt hàng và thanh toán

Sơ đồ mô tả cách BrewLite tạo đơn hàng và xác nhận thanh toán qua **VNPay Sandbox**.

**File sơ đồ:**
- [sequence-checkout.drawio](sources/sequence-checkout.drawio) – bản nguồn, chỉnh sửa bằng [diagrams.net](https://app.diagrams.net/).
- [sequence-checkout.puml](sources/sequence-checkout.puml) – bản nguồn PlantUML.
- [sequence-checkout.svg](exports/sequence-checkout.svg) – ảnh xuất để xem sơ đồ.

**Tài liệu đối chiếu:** [SRS](../requirements/srs.md) và [đặc tả Use Case Checkout](../requirements/use-case-checkout.md).

## Thành phần

`Customer` → `Next.js UI` → `NestJS API` → `Database` → `VNPay Sandbox`

- **Customer:** đặt hàng, thanh toán và xem kết quả.
- **Next.js UI:** nhận thao tác, gọi API và hiển thị trạng thái.
- **NestJS API:** kiểm tra dữ liệu, tạo đơn, xác minh thanh toán.
- **Database:** lưu đơn hàng, lượt thanh toán, nguyên liệu và điểm.
- **VNPay Sandbox:** cổng thanh toán thử nghiệm, gửi kết quả giao dịch.

## Luồng chính

1. Khách xác nhận giỏ hàng; UI gửi yêu cầu tạo đơn.
2. API xác thực JWT, kiểm tra giỏ và tính lại giá trên server.
3. API lưu đơn `PENDING` với hạn **15 phút**; **chưa trừ nguyên liệu**.
4. UI yêu cầu thanh toán; API kiểm tra `Idempotency-Key`, tạo hoặc trả lại lượt thanh toán phù hợp và cung cấp URL VNPay.
5. Khách thanh toán trên VNPay Sandbox. Backend nhận IPN hoặc kết quả đối soát và kiểm tra chữ ký, mã tham chiếu, số tiền.
6. Nếu giao dịch hợp lệ và đơn đủ điều kiện, API ghi `PAID`, trừ nguyên liệu và cộng điểm **đúng một lần**.
7. UI đọc trạng thái từ backend và hiển thị kết quả cho khách.

## Nhánh xử lý

- **Thanh toán thất bại:** ghi `PAYMENT_FAILED`; chỉ cho thử lại khi đơn còn hạn và lượt trước đã kết thúc rõ ràng.
- **Đang xác minh (`PENDING/UNKNOWN`):** chờ đối soát, không tạo lượt thanh toán cạnh tranh.
- **Gửi lại yêu cầu:** cùng `Idempotency-Key` và nội dung thì dùng lại kết quả/lượt cũ; IPN lặp không cập nhật kho hoặc điểm lần hai.
- **Đơn quá hạn:** không tạo lượt thanh toán mới; đối soát giao dịch chưa rõ trước khi quyết định hủy.
- **Thanh toán đến muộn hoặc thiếu nguyên liệu:** ghi nhận ngoại lệ và xử lý riêng, không tự chuyển đơn sai sang `PAID`.

## Ký hiệu UML

- Đường dọc nét đứt: **lifeline**.
- Thanh chữ nhật dọc: **activation bar** (khoảng thời gian xử lý).
- Mũi tên liền: **thông điệp gửi đi**; mũi tên nét đứt: **phản hồi**.
- Khung `alt`: **những nhánh loại trừ nhau theo điều kiện**.

> Các tên endpoint và thông điệp trong sơ đồ mang tính minh họa thiết kế, không phải cam kết API đã triển khai.
