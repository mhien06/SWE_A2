# Kho và công thức — triển khai local

Đối chiếu SRS FR-10, FR-17, FR-21, FR-25, FR-26, NFR-04 và ADR-006.

## Sử dụng

Đăng nhập tài khoản MANAGER tại Web A2, chọn **Kho & công thức** (`/staff/inventory`). STAFF và CUSTOMER bị API từ chối với 403.

- Nguyên liệu: xem tồn, đơn vị, ngưỡng thấp; thêm nguyên liệu; điều chỉnh tồn dương/âm kèm lý do. Không cho tồn âm. Có cảnh báo khi tồn <= ngưỡng.
- Công thức: chọn món, công thức nền hoặc size/topping bổ sung; nhập định lượng từng nguyên liệu. Lưu tạo phiên bản mới, giữ phiên bản cũ và lưu người tạo/thời gian. Có thể lấy phiên bản cũ làm mẫu chỉnh sửa.
- Lịch sử: tối đa 100 biến động gần nhất, lọc theo nguyên liệu; phân biệt điều chỉnh, trừ theo đơn và hoàn kho. Hiển thị người thao tác, lý do, thời gian, mã đơn.
- Công thức nền bao gồm size S theo seed/contract hiện tại. Size khác và mọi topping cần công thức bổ sung; thiếu công thức nền, thiếu topping, tùy chọn ngừng bán hoặc thiếu công thức bổ sung đều không được trừ một phần rồi coi thành công.
- Tạo đơn không trừ kho. Thanh toán hợp lệ trừ kho theo transaction hiện có; thiếu nguyên liệu/công thức đi vào xử lý ngoại lệ. Hủy hợp lệ hoàn theo snapshot đã trừ, không theo công thức hiện tại.

## Cấu trúc và API

Migration `20261115140000_recipe_actor` chỉ thêm người tạo phiên bản công thức và khóa ngoại. Phiên bản cũ hiển thị “Dữ liệu cũ / seed”; không gán ngược người tạo giả. Không reset, seed lại hoặc sửa tồn của database phát triển.

Các API dưới `/staff/inventory` đều yêu cầu MANAGER:

- GET/POST `ingredients`; PATCH `ingredients/:id/stock`
- GET/POST `recipes` (GET gồm cả phiên bản lưu trữ)
- GET `catalog` (món/tùy chọn để soạn công thức)
- GET `history?ingredientId=<uuid>` (tham số lọc tùy chọn)

## Kiểm thử PostgreSQL riêng

Tạo database riêng tên `brewlite_inventory_test`, cung cấp URL kết nối qua `INVENTORY_TEST_DATABASE_URL`. Test có guard từ chối tên database khác. Không dùng database phát triển hoặc production.

```powershell
# Điền URL của database test riêng trong terminal, không commit thông tin đăng nhập.
$env:INVENTORY_TEST_DATABASE_URL = '<URL PostgreSQL của brewlite_inventory_test>'
$env:DATABASE_URL = $env:INVENTORY_TEST_DATABASE_URL
pnpm --filter api exec prisma migrate deploy --config prisma7.config.ts
pnpm --filter api test:inventory
```

Test tạo dữ liệu có ID/email riêng mỗi lần chạy, chỉ trong database test. Các kịch bản: thiếu topping/công thức/size, tranh chấp tồn giữa hai đơn, rollback, hoàn đồng thời sau thay công thức, ghi người sửa và lịch sử điều chỉnh, chặn tồn âm. Đây là test service với PostgreSQL thật; không thay thế E2E trình duyệt hay VNPay Sandbox.

Chạy quality gate thường bằng `pnpm lint`, `pnpm test`, `pnpm build`. Cấu hình CI có job step chạy database test riêng; trạng thái GitHub chưa được xác minh vì thay đổi chỉ ở local.
