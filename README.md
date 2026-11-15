# SWE_A2

## Tài liệu BrewLite và trạng thái bàn giao

### Yêu cầu
- [Task 1.1 – Bối cảnh và phạm vi](docs/requirements/context-and-scope.md)
- [Task 1.2 – SRS](docs/requirements/srs.md)
- [Task 1.3 – Đặc tả Use Case Checkout](docs/requirements/use-case-checkout.md)
- [Ma trận truy vết FR/NFR/BR](docs/traceability-matrix.md)

### Sơ đồ Task 2–3
- [Domain Class](docs/diagrams/domain-class.md)
- [Sequence Checkout](docs/diagrams/sequence-checkout.md)
- Nguồn có thể chỉnh sửa: [docs/diagrams/sources/](docs/diagrams/sources/)
- Bản xuất: [docs/diagrams/exports/](docs/diagrams/exports/)
- [Kiến trúc hệ thống và ADR](docs/architecture/architecture.md)
- [Deployment design – Task 3.2](docs/architecture/deployment.md)

### Chạy, bàn giao và tiến độ
- [Hướng dẫn chạy/deploy và tình trạng môi trường](docs/deployment.md)
- [Checklist nộp bài và minh chứng](docs/submission-checklist.md)

Tài liệu và sơ đồ Task 1–3 hiện có trên nhánh tích hợp. Repository hiện vẫn là scaffold Next.js (`apps/web`), NestJS (`apps/api`) và Prisma; README này không khẳng định nghiệp vụ, test nghiệp vụ, CI/CD hay production đã hoàn thành. Ma trận và checklist giữ các phần chưa có bằng chứng ở trạng thái Pending.

## Môi trường phát triển Docker

Cài Docker Desktop, bật Linux containers. Chạy các lệnh từ thư mục gốc repository. Không cần cài Node/pnpm/PostgreSQL trên máy khi dùng Docker.

1. Nếu chưa có `.env`, sao chép `.env.example` thành `.env` (`Copy-Item .env.example .env` trong PowerShell). Giữ nguyên `.env` hiện có; bổ sung biến thiếu theo file mẫu. Thông tin đăng nhập mẫu chỉ dành cho local.
2. Kiểm tra cổng: `Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,3001,5433 }`. Không tự dừng tiến trình chưa xác định. Có thể đặt `WEB_PORT`, `API_PORT`, `POSTGRES_PORT` khác trong `.env` nếu cổng bận.
3. Chạy `docker compose config --quiet`, `docker compose build`, `docker compose up -d`, rồi `docker compose ps`.
4. Mở Web tại http://localhost:3000 và API tại http://localhost:3001 (API scaffold trả `Hello World!`). Nếu đổi cổng, dùng cổng tương ứng. PostgreSQL: localhost:5433 trên host; API dùng `postgres:5432` trong mạng Compose.

Ảnh dev dùng Node.js 24 và pnpm 11.25.0. Dependencies được cài trong Linux, không mount `node_modules` Windows. Web `app/`, `public/` và API `src/`, `prisma/`, `prisma7.config.ts` được bind mount; sửa source có hot reload (polling cho Windows). Khi đổi dependencies, lockfile hoặc config khác, chạy lại `docker compose up -d --build`. Web đang dùng Webpack cho chế độ dev với polling.

`NEXT_PUBLIC_API_URL` là địa chỉ API cho trình duyệt; `API_INTERNAL_URL` dành cho truy cập từ container Web. Scaffold chưa có luồng gọi API nghiệp vụ. Healthcheck Web/API kiểm tra HTTP `/`; PostgreSQL dùng `pg_isready`, API chỉ khởi động sau khi database healthy.

### Prisma và dữ liệu

Cấu hình giữ tại `apps/api/prisma7.config.ts`, schema tại `apps/api/prisma/schema.prisma`; Prisma 7 và adapter PostgreSQL đã có trong API. Kiểm tra bằng:

```sh
docker compose exec api pnpm exec prisma validate --config prisma7.config.ts
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;"'
```

Schema hiện chưa có model; không tự chạy migration, `db push` hoặc tạo bảng nghiệp vụ. Khi chạy Prisma trên host, cung cấp `DATABASE_URL` qua môi trường hoặc `apps/api/.env` (Prisma không tự đọc `.env` ở root khi chạy trong API).

PostgreSQL 17 lưu dữ liệu trong named volume `swe-a2-dev_postgres_data`, độc lập với container PostgreSQL đã có trên máy. `docker compose stop` hoặc `docker compose down` không xóa volume. **Không dùng `docker compose down -v` hoặc xóa volume.** Đổi user/password/database trong `.env` không cập nhật database đã khởi tạo; giữ thông tin cũ hoặc quản trị database riêng, không xóa dữ liệu để sửa lỗi.

Xem log bằng `docker compose logs --tail=100 api web postgres`. Đây là môi trường phát triển local, không bao gồm production deploy, CI/CD hay nghiệp vụ menu/checkout/thanh toán.

Nếu đang chạy Web/API/PostgreSQL trực tiếp trên các cổng mặc định, có thể thử Compose mà không dừng chúng bằng PowerShell:

```powershell
$env:WEB_PORT = '3100'
$env:API_PORT = '3101'
$env:POSTGRES_PORT = '5434'
docker compose up -d --build
docker compose ps
```

Khi đó truy cập http://localhost:3100 và http://localhost:3101. Các biến trên chỉ áp dụng cho terminal hiện tại; giữ cùng bộ cổng cho các lệnh `up` tiếp theo để tránh tạo lại container về cổng đang bị chiếm. Cấu hình mặc định vẫn là 3000/3001/5433.
