# Task 4.3 — Menu MVP

## 1. Phạm vi

Task 4.3 hiện thực luồng xem menu Sprint 1:

- `GET /products`: lấy danh sách sản phẩm đang có trong menu.
- `GET /products/:id`: lấy chi tiết sản phẩm cùng size/topping.
- Next.js menu mobile-first và trang chi tiết món.
- Loading, empty, error, not-found và retry.
- Prisma migration và seed PostgreSQL có thể chạy lại.

Không thuộc phạm vi: Cart, Checkout, Auth/JWT, Order, Payment và VNPay.

## 2. API contract

### `GET /products`

Phản hồi `200 OK`:

```json
[
  {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Cà phê sữa",
    "description": "Cà phê đậm vị hòa cùng sữa đặc ngọt dịu.",
    "basePrice": 29000,
    "isAvailable": true
  }
]
```

### `GET /products/:id`

- `id` phải là UUID v4; sai định dạng trả `400 Bad Request`.
- Không tìm thấy sản phẩm trả `404 Not Found`.
- Thành công trả `200 OK` cùng danh sách `options`.

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Cà phê sữa",
  "description": "Cà phê đậm vị hòa cùng sữa đặc ngọt dịu.",
  "basePrice": 29000,
  "isAvailable": true,
  "options": [
    {
      "id": "<uuid>",
      "type": "SIZE",
      "name": "M",
      "additionalPrice": 5000,
      "isAvailable": true
    }
  ]
}
```

`Product.isAvailable` thể hiện tình trạng bán. Tồn kho không nằm trên Product; Task 4.3 không dùng `Product.stock`.

## 3. Chạy local

Từ thư mục gốc repository:

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
$env:DATABASE_URL = "postgresql://brewlite:brewlite_local@localhost:5433/brewlite_dev?schema=public"
pnpm --filter api db:generate
pnpm --filter api db:migrate
pnpm --filter api db:seed
docker compose up -d --build --wait
```

Truy cập:

- Web menu: <http://localhost:3000>
- API menu: <http://localhost:3001/products>

Dừng dịch vụ nhưng giữ dữ liệu:

```powershell
docker compose down
```

## 4. Kiểm thử

```powershell
pnpm lint
pnpm test
pnpm build
```

Các ca kiểm thử Task 4.3:

- API danh sách sản phẩm.
- API chi tiết có size/topping.
- ID sai định dạng trả `400`.
- ID không tồn tại trả `404`.
- UI hiển thị loading rồi dữ liệu.
- UI empty state.
- UI error và retry.

## 5. Minh chứng Sprint 1

Kiểm tra local ngày 15/11/2026:

| Minh chứng | Kết quả |
|---|---|
| Prisma migration | `20261115071332_task4_menu_catalog` áp dụng thành công |
| Seed | 4 sản phẩm, mỗi sản phẩm có SIZE/TOPPING |
| Backend tests | 7/7 passed |
| Frontend tests | 3/3 passed |
| `GET /products` | HTTP 200, trả 4 sản phẩm |
| `GET /products/:id` | HTTP 200, trả size/topping |
| Web menu | HTTP 200 |
| Web detail | HTTP 200 |
| Docker Compose | PostgreSQL, API và Web đều healthy |

## 6. Truy vết và bàn giao

| Requirement | Hiện thực | Kiểm thử |
|---|---|---|
| FR-01 — xem menu | `ProductController.findAll`, `ProductService.findAll`, trang `/` | `product.controller.spec.ts`, `product.service.spec.ts`, `menu.test.tsx` |
| FR-02 — xem chi tiết món/tùy chọn | `ProductController.findOne`, `ProductService.findOne`, trang `/products/[id]` | API UUID/404/detail tests; component data/error tests |

Bảng trên là đầu vào để Hiệp cập nhật `docs/traceability-matrix.md` trong Issue #17; Task 4.3 không tự đánh dấu hoàn thành thay cho Task 4.2.

## 7. Phản hồi đưa vào Sprint 2

- Task #20 tiếp tục mở rộng schema Recipe/Ingredient và nghiệp vụ kho; không đưa tồn kho trở lại Product.
- Task #21 có thể thay static product-image mapping bằng dữ liệu media được quản lý nếu phạm vi UI Sprint 2 yêu cầu.
- Bộ lọc danh mục hiện là thành phần trình bày; API filter/search chỉ bổ sung khi có yêu cầu được duyệt.
