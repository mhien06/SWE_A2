## Nội dung

Hoàn thiện Task 2.2 theo review: bổ sung điều kiện tạo Payment, các nhánh IPN/QueryDR và tương tác hủy đơn. Bộ sơ đồ gồm tổng quan Checkout, tạo đơn, thanh toán VNPay và hủy đơn trước pha.

- Chặn attempt cạnh tranh khi PENDING/UNKNOWN; từ chối key khác payload và Order hết hạn.
- Tách Payment SUCCEEDED/FAILED khỏi Order PAID/PAYMENT_FAILED; xác minh IPN, chống lặp, xử lý đến muộn/thiếu kho.
- Thể hiện TX1/TX2/TX3 và rollback; hoàn kho theo usage, điều chỉnh điểm và chống bù trùng refund cũ.
- Thêm tương tác Customer thanh toán và Return URL chỉ phục vụ hiển thị.
- Bỏ tài liệu Sequence trùng trong requirements; bổ sung traceability BR-11/BR-12, E08/E09 và Activity thanh toán.
- Đồng bộ bốn bộ PlantUML, Draw.io, SVG, PNG; dùng phong cách đen trắng và actor hình người.

## Kiểm tra

- Kiểm tra cú pháp PlantUML bằng `-checkonly`.
- Kiểm tra XML Draw.io/SVG, liên kết Markdown và đối chiếu nhãn với PlantUML.
- Xem PNG để kiểm tra actor, activation, chữ và các khung nhánh.
- `git diff --check`.

## Cần reviewer xác nhận

Các đề xuất về thời điểm REDEEM, giao dịch đến sau hạn và cách lưu trạng thái ngoại lệ được nêu rõ trong `docs/diagrams/sequence-checkout.md`; cần thống nhất với Task 2.3/3.1.

Closes #5
