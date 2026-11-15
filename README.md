# BrewLite – SWE_A2

Dự án bài tập lớn học phần **Công nghệ Phần mềm (Assignment 2 – VER 1.0)**: phát triển hệ thống đặt món và thanh toán trực tuyến **BrewLite** từ đặc tả yêu cầu, mô hình hóa, thiết kế kiến trúc đến hiện thực qua 2 Sprint, thiết lập CI/CD và triển khai production.

- **Công nghệ bắt buộc:** Next.js (mobile-first/PWA), NestJS, PostgreSQL và Docker.
- **Cổng thanh toán thử nghiệm:** VNPay Sandbox (theo SRS và `ADR-004`, không sử dụng giao dịch tiền thật).
- **Runtime & Package Manager chuẩn (local / Docker / CI):** Node.js `24.x` (`node:24-bookworm-slim`), `pnpm@11.25.0` (quản lý qua `packageManager` và `pnpm-lock.yaml`).

---

## 1. Tài liệu dự án (Task 1 – Task 3)

Toàn bộ tạo phẩm của Task 1–3 được quản lý phiên bản trong thư mục `docs/` và giữ nguyên trạng thái đã nghiệm thu:

- [Task 1.1 – Bối cảnh, stakeholder và phạm vi](docs/requirements/context-and-scope.md)
- [Task 1.2 – Đặc tả yêu cầu phần mềm (SRS)](docs/requirements/srs.md)
- [Task 1.3 – Đặc tả Use Case trọng tâm (Đặt và thanh toán đơn hàng)](docs/requirements/use-case-checkout.md)
- [Task 2.1 – Activity Diagrams (`sources/` & `exports/`)](docs/diagrams/exports/)
- [Task 2.2 – Sequence Diagram Checkout](docs/diagrams/sequence-checkout.md)
- [Task 2.3 – Domain Class Diagram](docs/diagrams/domain-class.md)
- [Task 3.1 – Kiến trúc hệ thống và danh mục ADR (`001`–`011`)](docs/architecture/architecture.md)
- [Task 3.2 – UML Deployment Diagram](docs/architecture/deployment.md)
- [Ma trận truy vết FR/NFR/BR](docs/traceability-matrix.md)
- [Hướng dẫn chạy và bàn giao](docs/deployment.md)
- [Checklist nộp bài và minh chứng](docs/submission-checklist.md)

---

## 2. Cấu trúc Repository

Cấu trúc monorepo tuân thủ mục 9 của đề bài và [ADR-001](docs/architecture/adr/001-monorepo.md):

```text
SWE_A2/
├── apps/
│   ├── web/                  # Frontend Next.js (App Router, mobile-first/PWA)
│   └── api/                  # Backend NestJS (Modular Monolith) + Prisma 7
│       └── prisma/           # Schema, migrations và seed cho PostgreSQL (ADR-003)
├── docs/
│   ├── requirements/         # Task 1: Context & Scope, SRS, Use Case Checkout
│   ├── diagrams/             # Task 2 & 3: sources/ (.drawio, .puml) và exports/ (.svg)
│   └── architecture/         # Task 3: architecture.md, deployment.md, adr/ (001–011)
├── tests/                    # Kiểm thử tích hợp (Integration) và E2E liên ứng dụng
├── tools/                    # Script hỗ trợ kiểm tra/render sơ đồ tài liệu
├── .github/workflows/        # GitHub Actions CI/CD pipelines (Task 4.4, Task 5.3)
├── compose.yaml              # Docker Compose phát triển local (web, api, postgres)
├── .env.example              # Biến môi trường mẫu (không chứa secret thật)
├── package.json              # Scripts điều phối workspace gốc
├── pnpm-workspace.yaml       # Khai báo workspace apps/*
└── pnpm-lock.yaml            # Lockfile thống nhất giữa local, Docker và CI
```

---

## 3. Lệnh chuẩn toàn Workspace (Local & CI)

Chạy từ thư mục gốc repository (cần Node.js 24 và `pnpm@11.25.0` nếu chạy trực tiếp trên máy host):

| Thao tác | Lệnh toàn repo (root) | Lệnh riêng cho Web (`apps/web`) | Lệnh riêng cho API (`apps/api`) |
|---|---|---|---|
| **Cài đặt dependencies** | `pnpm install --frozen-lockfile` | `pnpm --filter web install` | `pnpm --filter api install` |
| **Chạy chế độ dev** | `pnpm dev` | `pnpm --filter web dev` | `pnpm --filter api dev` |
| **Kiểm tra mã nguồn (Lint)** | `pnpm lint` | `pnpm --filter web lint` | `pnpm --filter api lint` |
| **Chạy kiểm thử (Test)** | `pnpm test` | `pnpm --filter web test` | `pnpm --filter api test` (`test:e2e` cho E2E) |
| **Biên dịch (Build)** | `pnpm build` | `pnpm --filter web build` | `pnpm --filter api build` |

Workflow CI chạy cùng các lệnh root ở trên cho cả workspace Web và API. Xem [CI: quality gate, cấu hình và evidence](docs/ci.md).

- **Vị trí Prisma schema, migration và seed (`ADR-003`):** đặt tại `apps/api/prisma/` (`schema.prisma`, thư mục `migrations/` và script seed sẽ được bổ sung ở Task 4.3 / Task 5.2) cùng tệp cấu hình `apps/api/prisma7.config.ts`.

---

## 4. Môi trường phát triển Docker

Cài Docker Desktop, bật Linux containers. Chạy các lệnh từ thư mục gốc repository. Không cần cài Node/pnpm/PostgreSQL trên máy khi dùng Docker.

1. Nếu chưa có `.env`, sao chép `.env.example` thành `.env` (`Copy-Item .env.example .env` trong PowerShell). Giữ nguyên `.env` hiện có; bổ sung biến thiếu theo file mẫu. Thông tin đăng nhập mẫu chỉ dành cho local.
2. Kiểm tra cổng: `Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,3001,5433 }`. Không tự dừng tiến trình chưa xác định. Có thể đặt `WEB_PORT`, `API_PORT`, `POSTGRES_PORT` khác trong `.env` nếu cổng bận.
3. Chạy `docker compose config --quiet`, `docker compose build`, `docker compose up -d`, rồi `docker compose ps`.
4. Mở Web tại http://localhost:3000 và API tại http://localhost:3001 (API scaffold trả `Hello World!`). Nếu đổi cổng, dùng cổng tương ứng. PostgreSQL: `localhost:5433` trên host; API dùng `postgres:5432` trong mạng Compose.

Ảnh dev dùng Node.js 24 và pnpm 11.25.0. Dependencies được cài trong Linux, không mount `node_modules` Windows. Web `app/`, `public/` và API `src/`, `prisma/`, `prisma7.config.ts` được bind mount; sửa source có hot reload (polling cho Windows). Khi đổi dependencies, lockfile hoặc config khác, chạy lại `docker compose up -d --build`. Web đang dùng Webpack cho chế độ dev với polling.

`NEXT_PUBLIC_API_URL` là địa chỉ API cho trình duyệt; `API_INTERNAL_URL` dành cho truy cập từ container Web. Scaffold chưa có luồng gọi API nghiệp vụ. Healthcheck Web/API kiểm tra HTTP `/`; PostgreSQL dùng `pg_isready`, API chỉ khởi động sau khi database healthy.

### Prisma và dữ liệu

Cấu hình giữ tại `apps/api/prisma7.config.ts`, schema tại `apps/api/prisma/schema.prisma`; Prisma 7 và adapter PostgreSQL đã có trong API. Kiểm tra bằng:

```sh
docker compose exec api pnpm exec prisma validate --config prisma7.config.ts
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;"'
```

Schema hiện chưa có model; không tự chạy migration, `db push` hoặc tạo bảng nghiệp vụ ở bước scaffold. Khi chạy Prisma trên host, cung cấp `DATABASE_URL` qua môi trường hoặc `apps/api/.env` (Prisma không tự đọc `.env` ở root khi chạy trong API).

PostgreSQL 17 lưu dữ liệu trong named volume `swe-a2-dev_postgres_data`, độc lập với container PostgreSQL đã có trên máy. `docker compose stop` hoặc `docker compose down` không xóa volume. **Không dùng `docker compose down -v` hoặc xóa volume.** Đổi user/password/database trong `.env` không cập nhật database đã khởi tạo; giữ thông tin cũ hoặc quản trị database riêng, không xóa dữ liệu để sửa lỗi.

Xem log bằng `docker compose logs --tail=100 api web postgres`. Đây là môi trường phát triển local, không bao gồm production deploy, CI/CD, checkout hoặc thanh toán. Hướng dẫn Menu MVP nằm tại `docs/task4.3-menu-mvp.md`.

Nếu đang chạy Web/API/PostgreSQL trực tiếp trên các cổng mặc định, có thể thử Compose mà không dừng chúng bằng PowerShell:

```powershell
$env:WEB_PORT = '3100'
$env:API_PORT = '3101'
$env:POSTGRES_PORT = '5434'
docker compose up -d --build
docker compose ps
```

Khi đó truy cập http://localhost:3100 và http://localhost:3101. Các biến trên chỉ áp dụng cho terminal hiện tại; giữ cùng bộ cổng cho các lệnh `up` tiếp theo để tránh tạo lại container về cổng đang bị chiếm. Cấu hình mặc định vẫn là `3000`/`3001`/`5433`.

---

## 5. Chiến lược Nhánh, Pull Request, Quy ước Commit & Definition of Done (DoD)

### 5.1. Chiến lược nhánh (Branching Strategy) và Pull Request
- **`main`**: Nhánh phát hành ổn định (production/release). Chỉ nhận merge từ `develop` qua Pull Request phát hành khi kết thúc mốc Sprint/Release.
- **`develop`**: Nhánh tích hợp chính của dự án. Mọi công việc của từng Task phải tách nhánh từ `develop` và mở Pull Request (PR) về lại `develop`.
- **Các nhánh công việc (Working branches):**
  - `docs/<ten-task>`: Tài liệu yêu cầu, sơ đồ UML/C4, kiến trúc, ADR, ma trận truy vết (ví dụ: `docs/task1-requirements`, `docs/task3-architecture`).
  - `chore/<ten-task>`: Thiết lập cấu trúc repository, cấu hình công cụ, môi trường Docker (ví dụ: `chore/task4-repository`).
  - `feature/<ten-task>`: Hiện thực tính năng frontend/backend ở Sprint 1 và Sprint 2 (ví dụ: `feature/task4.3-menu-mvp`).
  - `ci/<ten-task>`: Thiết lập pipeline GitHub Actions CI/CD (ví dụ: `ci/task4.4-ci-pipeline`).
  - `fix/<ten-task>`: Sửa lỗi hoặc cập nhật sau review (ví dụ: `fix/task4.1-repository`).
- **Quy định Pull Request & Review:**
  - Không push trực tiếp lên `main` hoặc `develop`.
  - Mỗi PR phải liên kết với Issue tương ứng (`Closes #<id>` hoặc `Refs #<id>`), nêu rõ phạm vi thay đổi và cách kiểm tra.
  - Phải có ít nhất **01 thành viên khác trong nhóm review và approve**, đồng thời vượt qua các kiểm tra tự động (lint, test, build khi CI hoạt động ở Task 4.4) trước khi merge.
  - Mọi thay đổi đối với yêu cầu, sơ đồ hoặc kiến trúc đã chốt ở Task 1–3 đều phải đi qua commit/PR và ghi rõ lý do (Task 4.2).

### 5.2. Quy ước Commit (Commit Convention)
Áp dụng chuẩn **Conventional Commits**:

```text
<type>(<scope>): <mô tả ngắn gọn, rõ nghĩa>
```

- **`type`:**
  - `feat`: Thêm tính năng nghiệp vụ mới (`apps/web`, `apps/api`).
  - `fix`: Sửa lỗi mã nguồn hoặc chỉnh sửa theo phản hồi review.
  - `docs`: Thêm hoặc cập nhật tài liệu, sơ đồ, ADR, README, traceability matrix.
  - `chore`: Khởi tạo cấu trúc, cập nhật dependencies, cấu hình Docker/build.
  - `ci`: Thiết lập hoặc chỉnh sửa workflow GitHub Actions CI/CD.
  - `test`: Bổ sung hoặc cập nhật unit test, integration test, E2E test.
- **Ví dụ:** `chore(task4): initialize monorepo scaffold and Docker Compose dev environment`, `feat(task4.3): implement GET /products endpoint and mobile menu UI`.

### 5.3. Definition of Done (DoD)
Một Task / Issue chỉ được chuyển sang trạng thái **Done** khi thỏa mãn đầy đủ các tiêu chí:
1. **Đúng phạm vi & thứ tự tuần tự:** Tạo phẩm của các task tiên quyết đã có mặt trên repo và có lịch sử commit/PR rõ ràng; không dùng trạng thái của repo cũ làm minh chứng.
2. **Chất lượng mã nguồn & tài liệu:** Code tuân thủ kiến trúc module và tên trạng thái/thực thể đã duyệt ở Task 1–3; không chứa secret thật trong repository hoặc log.
3. **Kiểm tra tự động & thủ công:** Chạy thành công `pnpm lint`, `pnpm test`, `pnpm build` (và CI pipeline xanh kể từ Task 4.4).
4. **Truy vết (Traceability):** Liên kết rõ ràng giữa mã yêu cầu (`FR-*`, `NFR-*`, `BR-*`), sơ đồ thiết kế, mã nguồn/API và ca kiểm thử trong `docs/traceability-matrix.md`.
5. **Review & Merge:** PR đã được thành viên khác trong nhóm review, giải quyết hết thảo luận và merge vào `develop`.

---

## 6. Product Backlog & Kế hoạch Sprint (Issue Board)

Backlog của dự án được quản lý trực tiếp trên [GitHub Issues](https://github.com/mhien06/SWE_A2/issues) và tuân thủ **quy tắc thực hiện tuần tự**: `Task 1 → Task 2 → Task 3 → Task 4 → Task 5`.

### 6.1. Giai đoạn nền tảng đã nghiệm thu (Task 1 – Task 3)

| Issue | Hạng mục công việc | Phụ trách | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| [#1](https://github.com/mhien06/SWE_A2/issues/1) | **[Task 1.1]** Bối cảnh, stakeholder và phạm vi | Nguyễn Minh Hiển (`@mhien06`) | — | Done |
| [#2](https://github.com/mhien06/SWE_A2/issues/2) | **[Task 1.2]** Yêu cầu chức năng và phi chức năng (SRS) | Trần Minh Hiệp (`@TranMinhHiep2711`) | #1 | Done |
| [#3](https://github.com/mhien06/SWE_A2/issues/3) | **[Task 1.3]** Đặc tả một use-case trọng tâm (Checkout) | Phạm Minh Thiện (`@tp9951819-cell`) | #1, #2 | Done |
| [#4](https://github.com/mhien06/SWE_A2/issues/4) | **[Task 2.1]** Activity diagram | Trần Kim Xuyến (`@computerbotver2`) | Task 1 (#1–#3) | Done |
| [#5](https://github.com/mhien06/SWE_A2/issues/5) | **[Task 2.2]** Sequence diagram | Nguyễn Minh Hiển (`@mhien06`) | Task 1 (#1–#3) | Done |
| [#6](https://github.com/mhien06/SWE_A2/issues/6) | **[Task 2.3]** Class diagram | Chí Thành (`@chithanh2k6`) | Task 1 (#1–#3) | Done |
| [#7](https://github.com/mhien06/SWE_A2/issues/7) | **[Task 3.1]** Phương pháp và quyết định kiến trúc (C4 + ADR) | Trần Đăng Khoa (`@khoadangtran141006-svg`) | Task 2 (#4–#6) | Done |
| [#8](https://github.com/mhien06/SWE_A2/issues/8) | **[Task 3.2]** Deployment diagram | Trần Kim Xuyến (`@computerbotver2`) | #7 | Done |

### 6.2. Sprint 1 – Task 4: Thiết lập nền tảng, Quản lý tài liệu, MVP Xem Menu & CI

> **Sprint 1 Goal:** Tạo nền tảng kỹ thuật monorepo + Docker, kiểm soát phiên bản toàn bộ tài liệu thiết kế kèm ma trận truy vết, thiết lập CI pipeline tự động trên Pull Request và hoàn thiện MVP đầu tiên chạy được cho luồng xem menu.

| Issue | Hạng mục công việc | Phụ trách | Phụ thuộc |
|---|---|---|---|
| [#16](https://github.com/mhien06/SWE_A2/issues/16) | **[Task 4.1]** Thiết lập repository (`apps/web`, `apps/api`, Docker Compose, quy trình Git/DoD, Backlog) | Nguyễn Minh Hiển (`@mhien06`) | Task 1–3 (#1–#8) |
| [#17](https://github.com/mhien06/SWE_A2/issues/17) | **[Task 4.2]** Quản lý tài liệu và khởi tạo ma trận truy vết (`docs/traceability-matrix.md`) | Trần Minh Hiệp (`@TranMinhHiep2711`) | #16 |
| [#18](https://github.com/mhien06/SWE_A2/issues/18) | **[Task 4.3]** MVP Sprint 1 – Luồng xem menu (`GET /products`, `GET /products/:id`, UI mobile-first, seed, test) | Chí Thành (`@chithanh2k6`) | #16 |
| [#19](https://github.com/mhien06/SWE_A2/issues/19) | **[Task 4.4]** Continuous Integration – CI Pipeline (`Install → Lint → Unit Test → Build`) | Trần Minh Hiệp (`@TranMinhHiep2711`) | #16 |

### 6.3. Sprint 2 – Task 5: Hoàn thiện MVP, Kiểm thử tích hợp, CD & Triển khai Production

> **Sprint 2 Goal:** Hoàn thành luồng nghiệp vụ end-to-end (chi tiết món, giỏ hàng, JWT auth, đặt đơn, thanh toán VNPay Sandbox, hủy đơn/đối soát, theo dõi đơn), bổ sung đầy đủ unit/integration/E2E test, tự động hóa CD pipeline và triển khai bản production truy cập được qua HTTPS.

| Issue | Hạng mục công việc | Phụ trách | Phụ thuộc |
|---|---|---|---|
| [#20](https://github.com/mhien06/SWE_A2/issues/20) | **[Task 5.1]** Auth JWT, API tạo đơn và nghiệp vụ kho/điểm (`OrderModule`, `InventoryModule`, `LoyaltyModule`) | Trần Đăng Khoa (`@khoadangtran141006-svg`) | Task 4 (#16–#19) |
| [#21](https://github.com/mhien06/SWE_A2/issues/21) | **[Task 5.1]** Hoàn thiện UI, JWT/lỗi, chi tiết đơn và component test (`apps/web`) | Chí Thành (`@chithanh2k6`) | Task 4 (#16–#19), #20 |
| [#22](https://github.com/mhien06/SWE_A2/issues/22) | **[Task 5.1]** VNPay Sandbox, IPN Webhook và job đối soát (`PaymentModule`, `SchedulerModule`) | Nguyễn Minh Hiển (`@mhien06`) | #20 |
| [#23](https://github.com/mhien06/SWE_A2/issues/23) | **[Task 5.2]** Tích hợp, kiểm thử (unit/integration/E2E), Docker Compose và `/health` | Trần Kim Xuyến (`@computerbotver2`) | #20, #21, #22 |
| [#24](https://github.com/mhien06/SWE_A2/issues/24) | **[Task 5.3]** Continuous Delivery – Docker image, GHCR và pipeline triển khai | Phạm Minh Thiện (`@tp9951819-cell`) | #19, #23 |
| [#25](https://github.com/mhien06/SWE_A2/issues/25) | **[Task 5.3 + 5.4]** Deploy production HTTPS, smoke test, rollback, release notes, demo & Sprint Review/Retro | Nguyễn Minh Hiển (`@mhien06`) + Phạm Minh Thiện (`@tp9951819-cell`) | #23, #24 |

## 7. Task 4.3 — Menu MVP

API contract, migration/seed, cách chạy, kiểm thử và minh chứng demo được ghi tại [docs/task4.3-menu-mvp.md](docs/task4.3-menu-mvp.md).
