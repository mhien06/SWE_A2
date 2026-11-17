# Task 5.4 — Sprint Review & Retrospective

**Trạng thái:** BẢN DỰ THẢO tổng hợp từ GitHub; **không phải biên bản một cuộc họp đã diễn ra**.

## 1. Sprint Review — Kết quả có thể đối chiếu

### Sprint 1 — Nền tảng và thiết kế

Tài liệu yêu cầu, Use Case, sơ đồ nghiệp vụ, thiết kế kiến trúc và các ADR được quản lý trong [docs/requirements](requirements/), [docs/diagrams](diagrams/) và [docs/architecture](architecture/). Kết quả nghiệm thu chi tiết xem PR/Issue tương ứng; không tự chuyển mục thiếu chứng cứ sang hoàn thành.

### Sprint 2 — Hiện thực, kiểm thử và deploy

- Có mã nguồn Web/API và Prisma migration trong repository.
- CI của GitHub Actions [run #26](https://github.com/mhien06/SWE_A2/actions/runs/43946846633) **PASS**: lint, test, build, Task 5.2 PostgreSQL integration + browser E2E (payment provider mô phỏng).
- CD trong cùng run **PASS**: Deploy Hook Vercel accepted, Render deployment đạt live, smoke frontend/health/ready đạt.
- Bằng chứng frontend, backend, CI/CD: [Issue #24](https://github.com/mhien06/SWE_A2/issues/24).
- Không suy ra QueryDR live hoặc rollback drill đạt từ test mô phỏng và smoke test.

### Demo và phản hồi

- Kịch bản demo: [task5.4-demo.md](task5.4-demo.md).
- Phản hồi thực tế của giảng viên/khách mời: **Chưa được ghi nhận**.
- Video/biên bản buổi demo: **Chưa được ghi nhận**.
- Những hạng mục chưa xác minh: QueryDR Sandbox trực tiếp, thử rollback, cold-start IPN, test người ngoài nhóm cài đặt độc lập.

## 2. Sprint Retrospective — Quan sát dựa trên bằng chứng

| Nội dung | Quan sát có căn cứ | Đề xuất cải tiến |
|---|---|---|
| Điểm tốt | CI kiểm thử độc lập đạt; backend Render và smoke production đạt theo run #26 | Duy trì quality gate trước khi deploy |
| Trở ngại | Nhiều lần CD thất bại do khai báo reusable-workflow secrets, token/scope Vercel và environment URL không được cung cấp | Thiết lập checklist kiểm tra secrets, variables, branch tracking và test workflow trước merge |
| Khác biệt cấu hình | Render được tạo thủ công; `render.yaml` là Blueprint tham khảo | Tài liệu phải mô tả triển khai thật, không đồng nhất với phương án thiết kế |
| Giới hạn free tier | Cold start, scheduler có thể tạm dừng, hạn dùng DB | Kiểm tra readiness và backup trước demo, có kịch bản đối soát khi API hoạt động lại |
| Truy vết | Evidence cloud đã đính kèm Issue #24, nhưng tài liệu còn một số Pending | Dẫn liên kết chính xác theo commit/run/deployment và ghi trạng thái chưa xác minh |

**Đây là đề xuất Retro**, không tuyên bố nhóm đã nhất trí hoặc thực hiện các cải tiến này.

## 3. Action items đề xuất để nhóm xác nhận

| Công việc | Người đề xuất phụ trách | Mốc | Trạng thái |
|---|---|---|---|
| Chốt ma trận minh chứng Task 1–5 và bản release | Hiển | Trước nộp bài | Đang chuẩn bị |
| Kiểm tra lại Vercel deployment SHA và health URLs | Hiển | Trước demo | Cần xác nhận |
| Rà soát QueryDR Sandbox, IPN cold start và rollback drill bằng môi trường an toàn | Chủ nhiệm phần thanh toán/deploy và reviewer | Khi có điều kiện thử an toàn | Chưa có bằng chứng |
| Ghi người tham gia/ý kiến thực tế sau buổi Sprint Review/Retro | Nhóm | Sau buổi họp | Chưa cập nhật |

## 4. Biên bản chính thức (chỉ điền sau cuộc họp thực)

- Ngày giờ và hình thức họp: **Chưa cập nhật**
- Người tham dự: **Chưa cập nhật**
- Các phản hồi thực tế và quyết định: **Chưa cập nhật**
- Người chịu trách nhiệm/thời hạn được nhóm đồng thuận: **Chưa cập nhật**
