# Nghiệp vụ vận hành trên local

Ngày kiểm tra: 2026-11-15. Chỉ thay đổi local, chưa push hoặc xác nhận CI trên GitHub.

## Màn hình

- `/manager/products`: Manager thêm/sửa tên, mô tả, giá; bật/tắt bán; bắt buộc lý do; xem người sửa và thời điểm. Món mới mặc định ngừng bán, có size S. Tạo công thức trong kho rồi mới mở bán. Giá/tên trên đơn cũ giữ snapshot.
- `/staff/inventory`: Manager quản lý nguyên liệu, kiểm kê tăng/giảm có lý do, cảnh báo ngưỡng tồn, tạo phiên bản công thức cơ bản/size/topping, xem lịch sử kho. Xem thêm `inventory-local.md`.
- `/staff/orders`: Staff/Manager xử lý đơn theo PAID → PREPARING → READY_FOR_PICKUP → COMPLETED; hủy PAID cần lý do. Danh sách tự tải lại mỗi 15 giây, có nút làm mới và 200 đơn gần nhất. Tra cứu UUID cho đơn ngoài danh sách.
- Nhật ký đơn: người chuyển bước, hủy, các lượt thanh toán, refund cũ, biến động điểm và nguyên liệu theo snapshot; lọc sự kiện thanh toán bằng mã payment, loại hoặc ngày.
- `/orders/[id]`: khách chỉ xem đơn của mình, gồm toàn bộ lượt thanh toán.
- `/loyalty`: số dư và sổ điểm; header có tên/vai trò và điểm của khách.

## Đối chiếu SRS

FR-01–14: menu/options/cart/auth, server pricing, pending 15 phút, VNPay ký/xác minh, retry/idempotency/expiry/reconcile đã có trong các module hiện tại; bổ sung lịch sử tất cả payment attempts trên chi tiết đơn.
FR-15–20: hủy trước pha, hoàn đúng usage, hoàn điểm đã dùng, đảo thưởng, bù ceil(VNPay/100), loại trừ refund cũ đã có; bổ sung kiểm thử hủy lặp và màn ledger. Không thêm nghiệp vụ hoàn tiền ngân hàng mới.
FR-21/25: bổ sung UI kho/công thức/sản phẩm, audit người sửa công thức và sản phẩm.
FR-22/23: UI điểm, tên khách, lịch sử/chi tiết đơn.
FR-24/26: chuyển bước ghi actor trong cùng transaction; UI nhật ký, lịch sử và tìm đơn. Không tạo lại audit cho các chuyển bước diễn ra trước migration.

## Kiểm thử đã chạy

- API unit: 40 pass.
- Web component: 20 pass.
- PostgreSQL riêng `brewlite_inventory_test`: 8 pass, gồm thiếu công thức/topping, tranh chấp tồn, hoàn sau đổi công thức, rollback, không âm kho, giữ snapshot khi sửa món, chuyển bước đồng thời chỉ thành công và ghi audit một lần.
- Build API/web thành công; lint API và web không có lỗi (web còn cảnh báo alt ở mock ảnh trong menu.test.tsx).

Migration cộng thêm bảng audit, không xóa đơn, kho hay điểm hiện tại. DB test tách biệt khỏi dữ liệu demo.

## Giới hạn xác minh

Chưa xác minh trực quan các màn mới bằng trình duyệt tự động. Chưa có bằng chứng E2E trình duyệt đầy đủ cho toàn bộ SRS, PWA/offline, đo hiệu năng, hay triển khai HTTPS bàn giao. Vì vậy không coi toàn bộ NFR/acceptance đã nghiệm thu chỉ dựa trên unit/integration tests. Tỷ lệ tích điểm giữ theo cấu hình hiện tại, không tự quyết chính sách còn mở trong SRS.
