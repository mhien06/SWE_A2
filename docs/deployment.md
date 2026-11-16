# Task 5.3 - Production deployment và bàn giao

| Hạng mục | Cấu hình Task 5.3 |
|---|---|
| Frontend | Next.js trên Vercel, HTTPS |
| Backend | NestJS Docker trên Render, Git-backed Dockerfile |
| Database | Render PostgreSQL, kết nối bằng Internal Database URL |
| Thanh toán | VNPay Sandbox; Return về Vercel, IPN vào Render API |
| CD | Chỉ chạy sau job CI xanh trên push `develop` |
| Registry | Không dùng GHCR trong biến thể này; Render build đúng commit từ Git |
| Trạng thái production | Chỉ hoàn tất sau khi điền URL và evidence thật ở §8 |

## 1. Artifact triển khai

- `apps/api/Dockerfile`: multi-stage production image, non-root user.
- `render.yaml`: Render API + PostgreSQL Blueprint; auto deploy tắt để GitHub Actions điều phối đúng SHA.
- `.github/workflows/cd.yml`: deploy Vercel/Render, chờ Render và chạy smoke test.
- `.github/workflows/ci.yml`: gọi CD chỉ sau toàn bộ quality gate thành công trên `develop`.
- `tools/smoke-production.mjs`: kiểm tra frontend, `/health`, `/health/ready`.

Render Free không hỗ trợ `preDeployCommand`. Vì vậy image chạy `prisma migrate deploy` trước khi khởi động API; migration thất bại thì container không nhận traffic. Lệnh này idempotent và **không chạy seed production**.

## 2. Tạo Vercel project

1. Import repository `mhien06/SWE_A2`.
2. Chọn Root Directory `apps/web`, Framework Preset `Next.js`, Production Branch `develop`.
3. Thêm Production Environment Variable `NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com`.
4. Lấy `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` và tạo token CI.

Không đặt `JWT_SECRET`, `VNP_HASH_SECRET` hoặc `DATABASE_URL` ở Vercel.

## 3. Tạo Render API và PostgreSQL

Tạo Blueprint từ `render.yaml`, nhập các giá trị `sync: false`:

| Biến | Giá trị |
|---|---|
| `WEB_ORIGIN` | URL production Vercel, không có dấu `/` cuối |
| `VNP_TMN_CODE` | Mã merchant VNPay Sandbox |
| `VNP_HASH_SECRET` | Secret VNPay Sandbox |
| `VNP_RETURN_URL` | `https://<vercel-domain>/checkout/return` |

Blueprint tự nối `DATABASE_URL` bằng private connection string và tạo `JWT_SECRET`. Giữ `Auto-Deploy = Off`; CD gọi Render API với đúng commit SHA đã qua CI.

VNPay IPN public URL:

```text
https://<render-service>.onrender.com/payments/vnpay/ipn
```

## 4. GitHub Environment và secrets

Tạo Environment `production` rồi cấu hình:

| Loại | Tên | Nội dung |
|---|---|---|
| Secret | `VERCEL_TOKEN` | Token deploy Vercel |
| Secret | `VERCEL_ORG_ID` | Team/User ID của Vercel |
| Secret | `VERCEL_PROJECT_ID` | Project ID của Vercel |
| Secret | `RENDER_API_KEY` | Render API key có quyền deploy service |
| Secret | `RENDER_SERVICE_ID` | ID dạng `srv-...` |
| Variable | `WEB_PRODUCTION_URL` | URL Vercel cố định |
| Variable | `API_PRODUCTION_URL` | URL Render cố định |

Không ghi các giá trị trên vào commit, PR description, ảnh chụp hoặc workflow log.

## 5. Release và smoke test

1. Merge PR vào `develop`.
2. Workflow `CI` chạy lint, test, build và Task 5.2 integration/E2E.
3. Job `deploy-production` chỉ chạy khi job `ci` thành công.
4. Vercel deploy frontend; Render build `apps/api/Dockerfile` từ cùng SHA.
5. Render chạy migration rồi API; workflow chờ trạng thái `live`.
6. Smoke test phải đạt cả frontend, `/health` và `/health/ready`.

Chạy lại smoke test thủ công:

```bash
node tools/smoke-production.mjs \
  --web https://<web>.vercel.app \
  --api https://<api>.onrender.com
```

Kiểm tra thêm CORS, VNPay Return/IPN và QueryDR trên URL public. Không dùng giao dịch tiền thật.

## 6. Backup, migration và rollback

- Trước migration có thay đổi dữ liệu/phá vỡ tương thích: tạo backup PostgreSQL và ghi thời điểm/owner.
- Migration phải backward-compatible với bản app trước; không xóa cột trong cùng release thêm code thay thế.
- Rollback app: revert commit lỗi qua PR vào `develop`; CI xanh sẽ deploy lại commit revert.
- Có thể deploy SHA cũ bằng Render/Vercel dashboard khi khẩn cấp, sau đó vẫn phải tạo PR đồng bộ lịch sử.
- Rollback app **không tự đảo schema**. Chỉ chạy down/fix-forward migration khi đã kiểm tra backup và có người review.

## 7. Hạn chế vận hành

- Render Free có cold start; lần gọi đầu có thể chậm. Smoke workflow retry tối đa khoảng 6 phút.
- Scheduler nằm trong API nên không chạy khi instance ngủ; khi thức dậy phải tiếp tục đối soát `PENDING/UNKNOWN` bằng QueryDR.
- Filesystem container là ephemeral; dữ liệu bền vững chỉ lưu PostgreSQL.
- Database và gói miễn phí có giới hạn/thời hạn; kiểm tra lại trước buổi demo.

## 8. Evidence bàn giao

Chưa đánh dấu Task 5.3 hoàn tất cho tới khi điền đủ dữ liệu thật:

| Evidence | Giá trị |
|---|---|
| Commit SHA đã deploy | Pending |
| GitHub Actions run | Pending |
| Vercel production URL / deployment ID | Pending |
| Render API URL / deploy ID | Pending |
| `/health` và `/health/ready` | Pending |
| VNPay Return/IPN/QueryDR | Pending |
| Backup/rollback drill | Pending |
| Log đã kiểm tra không lộ secret | Pending |

Lưu ảnh/log đã che secret dưới `docs/evidence/task-5.3/` hoặc đính kèm trực tiếp vào Issue #24/PR.
