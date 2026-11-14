# Sequence Diagram – Đặt hàng và thanh toán

Sơ đồ mô tả quá trình khách hàng đặt hàng và thanh toán qua VNPay Sandbox trong hệ thống BrewLite.

## Thành phần tham gia

- **Customer:** Khách hàng thực hiện đặt hàng và thanh toán.
- **Next.js UI:** Giao diện tiếp nhận thao tác của khách hàng.
- **NestJS API:** Kiểm tra dữ liệu, xử lý đơn hàng và xác minh thanh toán.
- **Database:** Lưu trữ thông tin đơn hàng, thanh toán, nguyên liệu và điểm.
- **VNPay Sandbox:** Cổng thanh toán thử nghiệm.

## Luồng xử lý chính

1. Khách hàng chọn đặt hàng. Giao diện gửi giỏ hàng và JWT đến backend.
2. Backend xác thực, kiểm tra giỏ hàng và tính lại tổng tiền.
3. Hệ thống tạo đơn `PENDING` với thời hạn 15 phút. Chưa trừ nguyên liệu.
4. Khách hàng chọn thanh toán VNPay.
5. Backend kiểm tra yêu cầu thanh toán trùng. Nếu cần tạo lượt mới, hệ thống tạo mã giao dịch và trả URL thanh toán hợp lệ.
6. Khách hàng thực hiện thanh toán trên VNPay Sandbox.
7. VNPay gửi thông báo kết quả đến backend.
8. Backend xác minh chữ ký, mã giao dịch và số tiền:
   - **Thành công:** Cập nhật đơn `PAID`, trừ nguyên liệu và cộng điểm đúng một lần khi đủ điều kiện.
   - **Thất bại:** Ghi nhận `PAYMENT_FAILED`.
9. Giao diện lấy trạng thái đơn từ backend và hiển thị kết quả cho khách hàng.

## Các trường hợp cần lưu ý

- Yêu cầu thanh toán trùng không được tạo thêm lượt thanh toán không cần thiết.
- Giao dịch `PENDING/UNKNOWN` cần đối soát trước khi quyết định kết quả.
- Đơn hết hạn 15 phút không được tạo lượt thanh toán mới.
- Thanh toán thành công đến muộn hoặc thiếu nguyên liệu cần xử lý riêng, không cập nhật `PAID` sai.
- Return URL không được dùng để tự xác nhận thanh toán thành công.

## File sơ đồ

- `sources/sequence-checkout.drawio`: File sơ đồ có thể chỉnh sửa bằng Draw.io.
- `sources/sequence-checkout.puml`: Mã nguồn PlantUML.
- `exports/sequence-checkout.svg`: Hình ảnh sơ đồ xuất để xem trên GitHub.