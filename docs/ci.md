# CI quality gate

| Mục | Cấu hình |
|---|---|
| Workflow | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| Trigger | Pull request vào `develop` (opened, synchronize, reopened, ready for review) và push trực tiếp vào `develop` |
| Required status check | **`CI`** (job name; status context dùng trong branch protection/ruleset) |
| Runtime | Node.js `24.x`, pnpm `11.25.0`, theo `package.json`, lockfile và README |
| Database test service | PostgreSQL 17, database `brewlite_test`; chỉ dùng biến test cục bộ trong job, không dùng production secrets |
| Steps | Install → Lint (Web + API) → Unit tests (Web + API) → Build (Web + API) |

## Chạy local

Chạy từ thư mục gốc, bằng đúng phiên bản Node/pnpm trong README:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
```

Các scripts root điều phối workspace `apps/web` và `apps/api`; API scripts chạy Prisma Client generation trước lint/test/build. Cấu hình `DATABASE_URL` local từ `.env.example` trước khi chạy chúng. Không chạy migration hoặc seed như một phần CI quality gate.

## Hành vi workflow

- Không dùng path filter: mọi PR vào `develop` đều tạo check `CI`, kể cả thay đổi chỉ ở docs. Nhờ đó required check không bị skip hoặc treo khi branch protection đòi check.
- Install dùng `pnpm install --frozen-lockfile`; setup-node cache pnpm theo `pnpm-lock.yaml`.
- PostgreSQL service có health check và một URL/database riêng cho job. Workflow không đọc secrets production.
- Bất kỳ lệnh nào thất bại đều dừng job, nên PR không nhận check xanh. Workflow log luôn có trong Actions; các output step được lưu thêm thành artifact `ci-logs` kể cả khi một bước thất bại.
- Pull request phải qua check **CI**. Chủ repo cần bật branch protection/ruleset cho `develop`, bật require pull request, thêm required status check `CI`, rồi lưu ảnh chụp cấu hình. Workflow không thể tự đặt quy tắc bảo vệ repository.

## Required branch protection

Cấu hình mục tiêu cho `develop`:

1. Require a pull request before merging.
2. Require status checks to pass before merging.
3. Chọn đúng check **CI** (do job tên `CI` phát hành); không chọn workflow file path hoặc một check khác.
4. Không dùng path filtering cho workflow required này.
5. Xác minh bằng một lượt PR CI xanh và một PR có lỗi test bị check đỏ; sửa PR lỗi rồi xác minh lại màu xanh.

**Trạng thái cấu hình repository:** Pending owner/admin action với @mhien06. Tài khoản/connector hiện tại chưa xác nhận quyền quản trị để bật hoặc sửa branch protection. Sau khi được cấu hình, thêm link/ảnh chụp tại mục evidence bên dưới.

## Evidence

| Kết quả | Trạng thái | Link |
|---|---|---|
| PR CI xanh: install, lint, unit tests và build | Pending | Bổ sung GitHub Actions run sau khi workflow chạy trên PR |
| Lượt phát hiện lỗi test có chủ ý | Pending | Bổ sung failed Actions run; phục hồi test và kiểm tra lại xanh trước merge |
| Required check `CI` chặn merge trên `develop` | Pending | Ảnh/link branch protection do repo owner/admin xác nhận |
| Test tích hợp/E2E nghiệp vụ đầy đủ | Pending | @computerbotver2, [Issue #23](https://github.com/mhien06/SWE_A2/issues/23); module owners theo [traceability matrix](traceability-matrix.md) |

## Phạm vi hiện tại

Workflow xác minh các scripts đã có trong root, Web và API manifests; không tự tuyên bố nghiệp vụ đã hoàn tất. Các unit/API/component tests hiện có gồm [product controller](../apps/api/src/product/product.controller.spec.ts), [product service](../apps/api/src/product/product.service.spec.ts), [menu component](../apps/web/app/components/menu.test.tsx) và các tests scaffold. Integration/E2E cho checkout, VNPay, retry, expiry, cancellation và quyền truy cập vẫn do task phụ trách bổ sung.
