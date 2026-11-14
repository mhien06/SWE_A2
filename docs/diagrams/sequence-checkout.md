# Task 2.2 – Sequence Diagram: Đặt hàng và thanh toán

> **Dự án:** BrewLite – Assignment 2  
> **Người thực hiện:** Nguyễn Minh Hiển  
> **Đầu vào:** Task 1.1 (phạm vi), Task 1.2 (SRS), Task 1.3 (Use Case “Đặt hàng và thanh toán”) và Task 2.1 (Activity Diagram của Xuyến).  
> **Trạng thái:** Mô hình thiết kế để review, không khẳng định tính năng đã triển khai.

## 1. Cách đọc sơ đồ

Sơ đồ gồm đúng năm lifeline theo đề: **Customer, Next.js UI, NestJS API, Database, VNPay Sandbox «Payment Service»**. Đường dọc nét đứt biểu diễn thời gian; **hình chữ nhật mảnh trên lifeline là vùng hoạt động (activation bar)**. Mũi tên liền là yêu cầu/thông điệp, mũi tên nét đứt là phản hồi. Hai khung **`alt`** là hai lựa chọn loại trừ nhau.

| Giai đoạn | Diễn giải ngắn | Yêu cầu đối chiếu |
|---|---|---|
| Tạo đơn (1–6) | UI gửi giỏ và JWT; API kiểm tra, tính lại giá; **TX1** tạo `PENDING`, hạn 15 phút, **chưa trừ nguyên liệu**. | FR-04, FR-05, FR-06, FR-07; Task 1.3 M01–M05; Activity tạo đơn của Xuyến. |
| Thanh toán (7–14) | Gửi `Idempotency-Key`; API tra attempt cũ hoặc tạo attempt/TxnRef mới; chỉ dùng URL còn hợp lệ. | FR-08, FR-11, FR-12; Task 1.3 M06–M07/A05; Activity VNPay. |
| Xác nhận (15–18) | VNPay gửi IPN đến API; API kiểm chữ ký, mã, tiền; nhánh `alt` thành công/thất bại. **TX2** chỉ tạo `PAID` + trừ nguyên liệu + cộng điểm khi đủ điều kiện, tất cả đúng một lần. | FR-09, FR-10, FR-12; Task 1.3 M08–M09/A06; Activity VNPay. |
| Trả kết quả (19–23) | UI đọc trạng thái từ backend rồi hiển thị cho Customer. | FR-14; Task 1.3 M10; Activity thanh toán. |

## 2. Những trường hợp được cố ý không nhồi vào hình chính

- **JWT sai hoặc giỏ không hợp lệ:** API từ chối, không tạo Order (Task 1.3 E01–E02; Activity tạo đơn).
- **Attempt `UNKNOWN/PENDING`:** không tạo lượt cạnh tranh; cần đối soát (FR-11–FR-13, Task 1.3 E06).
- **Đơn quá hạn 15 phút:** ngăn tạo attempt mới; cần đối soát nếu giao dịch chưa rõ. Thử thanh toán lại không gia hạn Order (FR-07, FR-13).
- **Thanh toán VNPay thành công muộn, đơn đã hủy hoặc thiếu nguyên liệu:** giữ chứng cứ giao dịch, không ghi `PAID` sai; xử lý riêng theo SRS/Activity hủy đơn (FR-19–FR-20).
- **Return URL:** chỉ để điều hướng/hiển thị; không thay thế việc backend xác minh IPN/đối soát.
- **TX1 và TX2 là hai transaction khác nhau**: tạo đơn không làm thay đổi kho; thanh toán được xác minh hợp lệ mới cập nhật kho và điểm. Không tự cộng điểm bù trong luồng thanh toán thành công.

## 3. Đối chiếu với Task 2.1

| Activity của Xuyến | Bước tương ứng trong Sequence |
|---|---|
| Activity tạo đơn hàng | 1–6, TX1 tạo `PENDING`. |
| Activity thanh toán VNPay | 7–18, tra key, xác minh IPN, TX2 cập nhật kho/điểm hoặc `PAYMENT_FAILED`. |
| Activity hủy đơn và điều chỉnh điểm/kho | Không vẽ lại thành luồng chính ở Sequence checkout; chỉ ghi các trường hợp cần chuyển xử lý ngoại lệ. |

## 4. File nộp và checklist

```text
docs/diagrams/
├── sequence-checkout.md
├── sources/
│   ├── sequence-checkout.drawio
│   └── sequence-checkout.puml
└── exports/
    └── sequence-checkout.svg
```

- [ ] Có đủ 5 lifeline, mỗi lifeline quan trọng có activation bar.
- [ ] Mũi tên request/response có chiều và thứ tự hợp lý.
- [ ] Có kiểm JWT, validate giỏ, tính giá backend.
- [ ] TX1 tạo `PENDING`; TX2 cập nhật `PAID`, kho và điểm (hai transaction khác nhau).
- [ ] Khung `alt` cho idempotency và thanh toán thành công/thất bại.
- [ ] Có trả trạng thái backend để UI thông báo cho Customer.
- [ ] Các nhánh lỗi, quá hạn và bù điểm trong SRS/Activity không bị mô tả trái ngược.
- [ ] Source Draw.io và SVG đồng bộ, sơ đồ đen trắng và chữ đọc được.

**Lưu ý:** `/orders`, `/payments` và `/orders/:id` là tên minh họa ở mức thiết kế. Cần đối chiếu với API thực tế ở giai đoạn triển khai.
