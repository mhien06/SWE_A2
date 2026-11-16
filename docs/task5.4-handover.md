# Task 5.4 — Hồ sơ bàn giao BrewLite A2

**Phụ trách:** Nguyễn Minh Hiển · **Issue:** [#25](https://github.com/mhien06/SWE_A2/issues/25) · **Trạng thái:** chuẩn bị bàn giao, chưa đánh dấu nghiệm thu toàn bộ.

## 1. Phiên bản và địa chỉ

- Repository: https://github.com/mhien06/SWE_A2
- Nhánh phát triển/triển khai: `develop`
- Commit có minh chứng CI/CD: `3934c153a0c9c5e7cc9cc9f744d92abde2894d4e`
- [GitHub Actions #26 — CI, Vercel Hook, Render, smoke đều thành công](https://github.com/mhien06/SWE_A2/actions/runs/43946846633)
- Frontend HTTPS: https://swe-a2.vercel.app
- API HTTPS: https://brewlite-a2-api-0jkv.onrender.com
- Health: https://brewlite-a2-api-0jkv.onrender.com/health
- Readiness: https://brewlite-a2-api-0jkv.onrender.com/health/ready
- Render deployment ID trong CI: `dep-dbtm6sh5efls73e8uoe0`, đạt `live`
- Hình ảnh và liên kết bằng chứng: [Issue #24, bình luận bàn giao](https://github.com/mhien06/SWE_A2/issues/24#issuecomment-6928190209)

**Giới hạn xác minh:** Vercel Deploy Hook được CI chấp nhận, smoke test truy cập URL ổn định thành công; để xác định deployment Vercel *của đúng commit* đã Ready, cần đối chiếu thêm deployment ID/SHA trên Vercel Dashboard. Không dùng smoke của URL cố định để khẳng định chính xác bản Vercel vừa build.

## 2. Gói bàn giao

| Nội dung | Nguồn | Trạng thái |
|---|---|---|
| SRS / Use Case | [SRS](requirements/srs.md), [UC Checkout](requirements/use-case-checkout.md) | Có tài liệu trong repo |
| Sơ đồ nguồn / xuất | [diagrams](diagrams/), [Deployment](architecture/deployment.md) | Có trong repo; thiết kế giữ phân biệt với cấu hình thực tế |
| Mã nguồn / migrations | [apps/web](../apps/web), [apps/api](../apps/api), [Prisma](../apps/api/prisma) | Có trong repo |
| Kiểm thử local/simulated | [Task 5.2](../tests/task52/README.md), [Actions #26](https://github.com/mhien06/SWE_A2/actions/runs/43946846633) | CI có kết quả PASS |
| Docker/CI/CD | [Runbook](deployment.md), [Workflow](../.github/workflows/cd.yml) | CI/CD PASS theo run #26 |
| Bằng chứng cloud | [Issue #24](https://github.com/mhien06/SWE_A2/issues/24) | Đã đính kèm ảnh; đối chiếu trạng thái mới nhất khi demo |
| Ma trận truy vết | [Traceability](traceability-matrix.md) | Có tài liệu; cần kiểm tra các hàng vẫn Pending |
| GitHub Release/tag | [Bản nháp release notes](task5.4-release-notes.md) | **Chưa tạo tag hoặc Release** |
| Demo trực tiếp/video | [Kịch bản demo](task5.4-demo.md) | Kịch bản sẵn có; **chưa có video/link xác nhận** |
| Sprint Review/Retro | [Bản ghi dự thảo](task5.4-sprint-review-retro.md) | **Chưa xác nhận buổi họp nhóm đã diễn ra** |

## 3. Hướng dẫn người tiếp nhận

1. Clone `mhien06/SWE_A2` và xem phần **Local & CI** trong [README](../README.md).
2. Dùng Node.js 24, pnpm 11.25.0 và Docker; tạo cấu hình riêng từ `.env.example`, **không sao chép secret production**.
3. Đọc hướng dẫn [Task 5.2](../tests/task52/README.md) trước khi chạy test tích hợp; bộ test dùng PostgreSQL **riêng** và provider thanh toán mô phỏng.
4. Mở các URL A2, kiểm tra menu, đăng nhập, đặt hàng và /health; nếu service Render Free ngủ, lần đầu có thể chậm.
5. Xem [runbook](deployment.md) trước khi thay đổi môi trường hoặc thực hiện rollback. Không chạy seed/xóa dữ liệu trên DB production để thử nghiệm.

## 4. Hạn chế và đầu việc chưa có bằng chứng

- **QueryDR thực với VNPay Sandbox:** Task 5.2 đã thử QueryDR mô phỏng; chưa đính kèm chứng cứ truy vấn VNPay thật và đối chiếu một payment production cụ thể. Chỉ ghi nhận thành công của giao dịch Sandbox đơn lẻ đã quan sát, không suy rộng thành mọi nhánh thanh toán.
- **Rollback drill:** runbook có cách khôi phục ứng dụng nhưng chưa có log/thực nghiệm rollback production; không đánh dấu PASS.
- **IPN khi Render ngủ / callback đến muộn:** chưa có bằng chứng nghiệm thu public đầy đủ.
- **Vercel release SHA:** cần đối chiếu deployment details với commit; Deploy Hook chỉ xác nhận đã xếp lịch triển khai.
- **DB Free / cold start:** kiểm tra thời hạn và bảo toàn dữ liệu trước demo; database không được tự động reset.
- **Secret hygiene:** không đưa `DATABASE_URL`, `JWT_SECRET`, token, VNPay secret hoặc Deploy Hook URL vào issue, screenshot hoặc release.
- **Test độc lập người ngoài nhóm:** README có hướng dẫn; chưa có biên bản người ngoài nhóm clone và chạy thành công.

## 5. Điều kiện chốt Issue #25

- [ ] Người khác review PR và merge tài liệu vào `develop`.
- [ ] Chốt tag + GitHub Release từ commit thực sự được nghiệm thu (không gắn tag trước).
- [ ] Hoàn thành demo/đính link video hoặc biên bản demo.
- [ ] Nhóm xác nhận Sprint Review và Retrospective; ghi người tham gia, ngày, phản hồi thực tế.
- [ ] Kiểm tra lại truy cập ứng dụng, quyền xem repo của giảng viên và các giới hạn còn tồn tại.

Ghi rõ **ĐẠT / CHƯA XÁC MINH** theo chứng cứ thực tế, không dùng trạng thái workflow xanh để tự động khẳng định tất cả FR/NFR đều đạt.
