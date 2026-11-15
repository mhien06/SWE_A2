# Checklist nộp bài và minh chứng

> Căn cứ Assignment 2 PDF §9.1 và Issue [#17](https://github.com/mhien06/SWE_A2/issues/17). Đây là kiểm kê tại `develop` ngày 2026-11-15; trạng thái chỉ được nâng khi có artifact/link/kết quả xác minh. File tài liệu tồn tại không tự chứng minh code, test, CI hoặc production.

| # | Hạng mục PDF §9.1 | Trạng thái hiện tại | Minh chứng / việc còn thiếu |
|---:|---|---|---|
| 1 | Link repo và quyền truy cập cho giảng viên | Pending xác nhận quyền truy cập | [Repository SWE_A2](https://github.com/mhien06/SWE_A2); xác nhận tài khoản giảng viên có quyền xem |
| 2 | SRS, Use Case và traceability matrix | Tài liệu nguồn có; matrix được bổ sung trong PR này, chờ review/merge | [SRS](requirements/srs.md), [Use Case](requirements/use-case-checkout.md), [Matrix](traceability-matrix.md); code/test còn Pending theo matrix |
| 3 | Activity, Sequence, Class và Deployment diagrams | Nguồn/export có mặt và Task 1–3 được ghi nhận nghiệm thu trong README hiện tại; link artifact giữ nguyên | [Sơ đồ nguồn](diagrams/sources/), [bản xuất](diagrams/exports/), [Domain](diagrams/domain-class.md), [Sequence](diagrams/sequence-checkout.md), [Deployment](architecture/deployment.md) |
| 4 | Frontend/backend source và migration | Pending | Repo đang là scaffold; nghiệp vụ/migration chưa được xác nhận; owners theo [#18](https://github.com/mhien06/SWE_A2/issues/18), [#20](https://github.com/mhien06/SWE_A2/issues/20), [#21](https://github.com/mhien06/SWE_A2/issues/21), [#22](https://github.com/mhien06/SWE_A2/issues/22) |
| 5 | Unit, integration và E2E tests | Pending | Chưa có kết quả test nghiệp vụ được liên kết; @computerbotver2 [#23](https://github.com/mhien06/SWE_A2/issues/23), module owners #18/#20–#22 |
| 6 | CI/CD pipeline thành công | Pending evidence | CI quality gate @TranMinhHiep2711 [#19](https://github.com/mhien06/SWE_A2/issues/19); image/CD @tp9951819-cell [#24](https://github.com/mhien06/SWE_A2/issues/24); cần link run thành công/thất bại theo issue |
| 7 | Production URL, API và health | Pending | Chưa có production deployment evidence; @mhien06 và @tp9951819-cell [#25](https://github.com/mhien06/SWE_A2/issues/25), health/test @computerbotver2 [#23](https://github.com/mhien06/SWE_A2/issues/23) |
| 8 | Release notes, README và rollback guide | README hiện có hướng dẫn local; release notes/rollback production Pending | [README](../README.md), [deployment handoff](deployment.md); hoàn thiện cùng #24/#25 |
| 9 | Video/demo và Sprint Retrospective | Pending | Cần link demo, kết quả Sprint Review/Retro; @mhien06 và @tp9951819-cell [#25](https://github.com/mhien06/SWE_A2/issues/25) |

## Nguyên tắc cập nhật evidence

- Thay Pending bằng link trực tiếp tới PR/commit, test file và lần chạy, Actions workflow, production URL/health response hoặc demo artifact có thể kiểm tra.
- Đối với code/test/CI/deploy chưa làm hoặc chưa có bằng chứng, giữ Pending và ghi owner + issue; không suy luận hoàn tất từ kế hoạch hay sơ đồ thiết kế.
- Các link deployment hiện có là **thiết kế**. [docs/deployment.md](deployment.md) và [docs/architecture/deployment.md](architecture/deployment.md) giữ riêng vai trò run/handoff và deployment design, không khẳng định đã deploy.
