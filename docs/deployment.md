# Task 5.3 - Production deployment và bàn giao

| Hạng mục | Cấu hình Task 5.3 |
|---|---|
| Frontend | Next.js trên Vercel, HTTPS |
| Backend | NestJS Docker trên Render, Git-backed Dockerfile |
| Database | Render PostgreSQL, kết nối bằng Internal Database URL |
| Thanh toán | VNPay Sandbox; Return về Vercel, IPN vào Render API |
| CD | Chỉ chạy sau job CI xanh trên push `develop` |
| Registry | Không dùng GHCR trong biến thể này; Render build đúng commit từ Git |
| Trạng thái production | CI/CD run #26 đạt; các mục chưa xác minh nằm ở §8 |

## 1. Artifact triển khai

- `apps/api/Dockerfile`: multi-stage production image, non-root user.
- `render.yaml`: Blueprint tham khảo; các dịch vụ A2 được tạo thủ công trên Render.
- `.github/workflows/cd.yml`: kích hoạt Vercel Deploy Hook, deploy Render theo SHA, chờ trạng thái `live` rồi chạy smoke.
- `.github/workflows/ci.yml`: gọi CD chỉ sau toàn bộ quality gate thành công trên `develop`.
- `tools/smoke-production.mjs`: kiểm tra frontend, `/health`, `/health/ready`.

Render Free không hỗ trợ `preDeployCommand`. Vì vậy image chạy `prisma migrate deploy` trước khi khởi động API; migration thất bại thì container không nhận traffic. Lệnh này idempotent và **không chạy seed production**.

## 2. Vercel production và Deploy Hook

- Project frontend `swe-a2`, root `apps/web`, framework Next.js; URL: https://swe-a2.vercel.app.
- Nhánh production được cấu hình theo `develop`. API A2 công khai: https://brewlite-a2-api-0jkv.onrender.com.
- GitHub Actions **sau CI xanh** gọi Vercel Deploy Hook của project qua secret `VERCEL_DEPLOY_HOOK`. Không dùng Vercel CLI token trong workflow hiện hành.
- Deploy Hook xác nhận yêu cầu được nhận, **không chứng minh việc build mới đã Ready hoặc đúng SHA**; đối chiếu trên Vercel Dashboard.
- **Rủi ro thứ tự CI/CD:** Nếu Git Integration của Vercel vẫn auto-deploy khi push `develop`, build đó có thể chạy *trước* GitHub CI. Cần kiểm tra/kiểm soát cơ chế auto-deploy nếu yêu cầu chỉ phát hành khi CI xanh.

Không đưa `JWT_SECRET`, `VNP_HASH_SECRET` hoặc `DATABASE_URL` vào frontend.

## 3. Triển khai thực tế trên Render

BrewLite A2 được triển khai thủ công trên Render, sử dụng Docker cho Backend NestJS và PostgreSQL làm cơ sở dữ liệu.

| Thành phần | Cấu hình thực tế |
|---|---|
| Web Service | `brewlite-a2-api` |
| Runtime | Docker |
| Dockerfile | `apps/api/Dockerfile` |
| Region | Singapore |
| Database | `brewlite-a2-db` |
| PostgreSQL | Version 17 |
| Auto-Deploy | Off |
| Nhánh triển khai ban đầu | `ci/task5-cloud-delivery` |

Backend sử dụng Internal Database URL để kết nối PostgreSQL. Prisma migration được thực thi khi khởi động container. Dữ liệu mẫu được bổ sung riêng sau khi tạo database.

Frontend được triển khai bằng Next.js trên Vercel, sử dụng biến `NEXT_PUBLIC_API_URL` để gọi Backend qua HTTPS.

### Địa chỉ triển khai

- Frontend: https://swe-a2.vercel.app
- Backend: https://brewlite-a2-api-0jkv.onrender.com
- Health: https://brewlite-a2-api-0jkv.onrender.com/health
- Readiness: https://brewlite-a2-api-0jkv.onrender.com/health/ready

### VNPay Sandbox

- Return URL: https://swe-a2.vercel.app/checkout/return
- IPN URL: https://brewlite-a2-api-0jkv.onrender.com/payments/vnpay/ipn
- Giao thức IPN: GET
- Chữ ký: HMACSHA512

Đã kiểm thử một giao dịch VNPay Sandbox thành công trên môi trường triển khai. Các trường hợp đối soát QueryDR, IPN khi Backend không sẵn sàng và hoàn tiền cần được kiểm chứng riêng.

File `render.yaml` được lưu trong repository làm cấu hình tham khảo; không được sử dụng để tạo các dịch vụ Render hiện tại.


## 4. GitHub Environment và secrets

GitHub Environment `production`:

| Loại | Tên | Mục đích |
|---|---|---|
| Secret | `VERCEL_DEPLOY_HOOK` | URL hook kích hoạt Vercel deploy sau CI |
| Secret | `RENDER_API_KEY` | Xác thực Render API |
| Secret | `RENDER_SERVICE_ID` | ID Web Service dạng `srv-...` |
| Public variable/fallback | `WEB_PRODUCTION_URL` | https://swe-a2.vercel.app |
| Public variable/fallback | `API_PRODUCTION_URL` | https://brewlite-a2-api-0jkv.onrender.com |

Các secret Vercel CLI cũ không được workflow hiện hành sử dụng. Không công khai Deploy Hook, token, khóa VNPay/JWT hoặc mật khẩu DB.

## 5. Release và smoke test

1. Merge PR vào `develop` sau review.
2. CI chạy lint, unit, build, PostgreSQL integration và E2E Task 5.2 với provider thanh toán **mô phỏng**.
3. Khi CI xanh, CD kích hoạt Vercel Deploy Hook và Render build theo commit `github.sha`.
4. Render chạy migration trước khi phục vụ API; workflow chờ `live`.
5. Smoke kiểm tra frontend, `/health` và `/health/ready`.
6. Xác nhận trên Vercel Dashboard rằng deployment của đúng branch/commit đạt `Ready` (không suy ra từ hook và smoke URL cố định).

Chạy lại smoke tại repository root:

```bash
node tools/smoke-production.mjs --web https://swe-a2.vercel.app --api https://brewlite-a2-api-0jkv.onrender.com
```

**Bằng chứng:** [Actions run #26](https://github.com/mhien06/SWE_A2/actions/runs/43946846633) tại commit `3934c153a0c9c5e7cc9cc9f744d92abde2894d4e`; CI, Vercel Hook, Render và smoke đều **PASS**. Render deployment `dep-dbtm6sh5efls73e8uoe0` đạt `live`. Smoke ghi nhận PASS frontend, liveness và readiness.

CORS, Return/IPN và QueryDR thực phải có minh chứng nghiệm thu riêng, không thay thế bằng smoke.

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

| Minh chứng | Kết quả có thể xác minh |
|---|---|
| CI/CD commit SHA | `3934c153a0c9c5e7cc9cc9f744d92abde2894d4e` |
| GitHub Actions | [Run #26 — PASS](https://github.com/mhien06/SWE_A2/actions/runs/43946846633) |
| Vercel URL | https://swe-a2.vercel.app, smoke PASS; **deployment ID/Ready của SHA chưa đối chiếu riêng** |
| Render API | https://brewlite-a2-api-0jkv.onrender.com |
| Render deploy ID | `dep-dbtm6sh5efls73e8uoe0`, `live` |
| `/health`, `/health/ready` | PASS trong log smoke |
| VNPay Sandbox | Đã quan sát một lượt thanh toán thành công trên giao diện; **QueryDR trực tiếp và trường hợp IPN Render ngủ chưa có log xác nhận** |
| Rollback drill | Hướng dẫn tại §6; **chưa có chứng cứ thực hiện trên production** |
| Bảo vệ secret | Workflow không in giá trị secret; **chưa có biên bản rà soát toàn bộ log và lịch sử chia sẻ** |
| Ảnh và link | [Issue #24](https://github.com/mhien06/SWE_A2/issues/24#issuecomment-6928190209) |

Không đánh dấu các mục chưa kiểm thử thành PASS. Người tiếp nhận đối chiếu [hồ sơ Task 5.4](task5.4-handover.md) trước khi demo.

