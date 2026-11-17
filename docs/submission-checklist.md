# Checklist nộp bài và minh chứng — BrewLite A2

> Cập nhật theo bằng chứng đã kiểm tra ngày 17/11/2026. Đối chiếu chi tiết [hồ sơ bàn giao Task 5.4](task5.4-handover.md); mục chưa thử thật không được tự ghi PASS.

| # | Hạng mục | Trạng thái có bằng chứng | Nguồn / phần cần hoàn thiện |
|---:|---|---|---|
| 1 | Repository và quyền giảng viên | Repo có; **chưa xác minh quyền giảng viên** | [SWE_A2](https://github.com/mhien06/SWE_A2) |
| 2 | SRS, Use Case, truy vết | Có tài liệu; các hàng thiếu test cần đối chiếu | [SRS](requirements/srs.md), [UC](requirements/use-case-checkout.md), [Matrix](traceability-matrix.md) |
| 3 | Activity/Sequence/Class/Deployment diagrams | Có nguồn và bản xuất | [Sources](diagrams/sources/), [Exports](diagrams/exports/) |
| 4 | Frontend/API, Prisma migrations | Có mã nguồn và migration trong repo | [Web](../apps/web), [API](../apps/api), [Prisma](../apps/api/prisma) |
| 5 | Unit/integration/E2E | **PASS CI run #26**; Task 5.2 payment provider mô phỏng | [Run #26](https://github.com/mhien06/SWE_A2/actions/runs/43946846633), [Task 5.2](../tests/task52/README.md) |
| 6 | CI/CD | **PASS run #26**: CI, Vercel Deploy Hook, Render, smoke | [Run #26](https://github.com/mhien06/SWE_A2/actions/runs/43946846633), [Issue #24](https://github.com/mhien06/SWE_A2/issues/24) |
| 7 | Production URL / health | Smoke PASS; Vercel deployment SHA cần đối chiếu Dashboard | [Web](https://swe-a2.vercel.app), [Health](https://brewlite-a2-api-0jkv.onrender.com/health), [Ready](https://brewlite-a2-api-0jkv.onrender.com/health/ready) |
| 8 | README / Runbook / Release | README + runbook có; release notes **dự thảo**, tag/Release chưa tạo; rollback drill chưa có bằng chứng | [README](../README.md), [Runbook](deployment.md), [Release notes](task5.4-release-notes.md) |
| 9 | Video / demo / Sprint Review & Retro | Có kịch bản/bản dự thảo; **chưa có video, biên bản đã diễn ra** | [Demo](task5.4-demo.md), [Review/Retro](task5.4-sprint-review-retro.md) |

## Nguyên tắc cập nhật evidence

- Chỉ đánh dấu hoàn tất khi có URL, log hoặc PR/run chứng minh. Deploy Hook trả về thành công chỉ chứng minh yêu cầu đã được nhận, chưa chắc build Vercel của đúng SHA đã Ready.
- QueryDR thực trên Sandbox, IPN cold start và rollback production hiện chưa có chứng cứ riêng; integration test mô phỏng **không thay thế** kiểm thử Sandbox trực tiếp.
- Không công khai token, URL Deploy Hook, DATABASE_URL hay mật khẩu trong tài liệu và hình ảnh.
