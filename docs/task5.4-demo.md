# Task 5.4 — Kịch bản Demo BrewLite A2

**Trạng thái:** kịch bản chuẩn bị; chưa phải biên bản demo đã diễn ra.

## Chuẩn bị

- Mở https://swe-a2.vercel.app và https://brewlite-a2-api-0jkv.onrender.com/health/ready.
- Chuẩn bị tài khoản kiểm thử CUSTOMER/STAFF/ MANAGER bằng kênh nội bộ, tuyệt đối không ghi mật khẩu vào tài liệu công khai.
- Kiểm tra Render không còn cold start trước buổi demo; đảm bảo DB còn thời hạn.
- Có sẵn [CI/CD run #26](https://github.com/mhien06/SWE_A2/actions/runs/43946846633), [Issue #24 evidence](https://github.com/mhien06/SWE_A2/issues/24), tài liệu [Task 5.2](../tests/task52/README.md).

## Trình tự trình diễn đề xuất

| Bước | Thao tác | Kết quả cần quan sát |
|---:|---|---|
| 1 | Mở trang menu A2, chọn đồ uống và tùy chọn | Hiển thị sản phẩm, giá và lựa chọn |
| 2 | Đăng nhập CUSTOMER; thêm sản phẩm vào giỏ | Giỏ phản ánh lựa chọn thực tế |
| 3 | Tạo đơn và xem trạng thái trước thanh toán | Order mới cùng số tiền do backend tính |
| 4 | Chuyển sang VNPay **Sandbox** và hoàn tất giao dịch thử nghiệm | Quay lại trang Return, trạng thái thanh toán được backend xác minh |
| 5 | Mở lịch sử đơn của khách | Trạng thái Order khớp sau khi thanh toán |
| 6 | Mở màn hình STAFF (nếu quyền đã được cấp) | Xem và thao tác đúng trạng thái/role, không thay đổi đơn demo đã hoàn tất nếu không cần |
| 7 | Mở `/health`, `/health/ready`, GitHub Actions run #26 | Min chứng API/DB và CI/CD |
| 8 | Trình bày Task 1–3: SRS, Use Case, Class, Sequence, Deployment Diagram | Liên hệ yêu cầu → thiết kế → triển khai |
| 9 | Trình bày bộ test Task 5.2 (simulated provider) | Nêu rõ test mô phỏng khác thanh toán VNPay thật |

## Trường hợp lỗi cần nói rõ thay vì dựng kết quả

- IPN lặp, trùng payment, hết hạn, thiếu kho: trưng dẫn unit/integration/E2E và ghi rõ nguồn mô phỏng.
- QueryDR thực, rollback production, callback khi Render ngủ: **chưa có minh chứng thực hành riêng**; không trình diễn bằng cách gửi giả callback vào production hoặc đổi trạng thái DB.
- Nếu VNPay Sandbox không sẵn sàng lúc demo: dùng ảnh chứng cứ giao dịch đã có và giải thích giới hạn, không giả vờ thanh toán vừa thành công.

## Biên bản sau demo (điền khi thực sự diễn ra)

- Ngày/địa điểm: **Chưa cập nhật**
- Người tham gia: **Chưa cập nhật**
- Link video/ảnh: **Chưa cập nhật**
- Các bước PASS/FAIL: **Chưa cập nhật**
- Phản hồi của giảng viên/nhóm: **Chưa cập nhật**
