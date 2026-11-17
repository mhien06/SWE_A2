# Dự thảo Release Notes — BrewLite A2

**Trạng thái:** DỰ THẢO — chưa tạo Git tag hoặc GitHub Release. Chỉ phát hành sau khi PR tài liệu đã review/merge và xác nhận commit bàn giao.

## Tóm tắt bản phát hành đề xuất

BrewLite A2 là ứng dụng đặt đồ uống sử dụng frontend Next.js, API NestJS modular monolith, PostgreSQL và VNPay Sandbox. Nghiệp vụ gồm menu, giỏ, tài khoản, đơn hàng, giao dịch thanh toán, tồn kho và điểm thưởng theo đặc tả đã duyệt. Phần thiết kế/kiểm thử và phạm vi hiện thực được truy vết qua tài liệu dự án; không khẳng định mọi trường hợp đều được chạy thật trên Sandbox.

## Hạ tầng và kiểm chứng

- Frontend: https://swe-a2.vercel.app
- API: https://brewlite-a2-api-0jkv.onrender.com
- CI/CD: [run #26](https://github.com/mhien06/SWE_A2/actions/runs/43946846633) — CI, trigger Vercel Deploy Hook, Render deployment, smoke PASS.
- Commit tham chiếu cho run #26: `3934c153a0c9c5e7cc9cc9f744d92abde2894d4e`.
- Render deployment: `dep-dbtm6sh5efls73e8uoe0`; đối chiếu `live` trong workflow.
- Hướng dẫn deploy/rollback: [docs/deployment.md](deployment.md).
- Bằng chứng screenshots: [Issue #24](https://github.com/mhien06/SWE_A2/issues/24).

## Kiểm thử được xác minh và giới hạn

- CI kiểm thử lint, unit, build, PostgreSQL integration, Task 5.2 browser E2E sử dụng payment provider **mô phỏng**; đây không phải kết quả QueryDR Sandbox trực tiếp.
- Smoke production xác nhận frontend HTTP và API `/health`, `/health/ready`.
- Giao dịch VNPay Sandbox thành công đã được kiểm tra riêng qua UI trong quá trình triển khai; bằng chứng đối soát QueryDR thật, IPN khi backend ngủ và rollback production **chưa hoàn chỉnh**.
- Render Free có cold start, scheduler không chạy khi instance ngủ; PostgreSQL Free có giới hạn và vòng đời.

## Cách phát hành khi đã duyệt

1. Merge PR Task 5.4 sau CI + review; kiểm tra phiên bản vừa triển khai.
2. Ghi commit SHA thực tế và xác nhận trên Vercel/Render.
3. Tạo GitHub Release bằng tag mới chỉ vào commit đó, ví dụ `v1.0.0-a2` **nếu chưa trùng**. Không tạo tag vào một commit khác.
4. Dán release notes đã điều chỉnh, link hướng dẫn [README](../README.md), [runbook](deployment.md) và tài liệu bàn giao.

**Chưa tạo Release cho đến khi hoàn thành các điều kiện trên.**
