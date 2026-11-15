# Hướng dẫn chạy và bàn giao môi trường BrewLite

| Thuộc tính | Trạng thái |
|---|---|
| Repo/nhánh tài liệu | [SWE_A2](https://github.com/mhien06/SWE_A2), `develop` |
| Local development | Docker Compose; xem [README](../README.md#4-môi-trường-phát-triển-docker) |
| Deployment design | [Task 3.2 – Deployment Diagram](architecture/deployment.md) |
| Production deployment / URL | **Pending** — chưa có bằng chứng triển khai SWE_A2; owner @mhien06 / @tp9951819-cell, [#25](https://github.com/mhien06/SWE_A2/issues/25) |
| API health evidence | **Pending** — tích hợp health check/test ở [#23](https://github.com/mhien06/SWE_A2/issues/23), deploy verification ở [#25](https://github.com/mhien06/SWE_A2/issues/25) |

## Local run

Thực hiện đúng các lệnh, biến môi trường và lưu ý dữ liệu trong [README môi trường Docker](../README.md#4-môi-trường-phát-triển-docker). README hiện mô tả scaffold local và endpoint API scaffold; chưa có luồng nghiệp vụ. Không tự chạy migration hoặc xóa volume ngoài hướng dẫn.

## Tài liệu thiết kế và vận hành thực tế

[architecture/deployment.md](architecture/deployment.md) là tài liệu thiết kế Deployment Diagram Task 3.2, không phải biên bản xác nhận production. Tài liệu đó mô tả nền tảng mục tiêu cùng health/logs/migration/scheduler; chi tiết production chỉ được chuyển sang trạng thái hoàn tất khi Task 5.3–5.4 có cấu hình, URL và minh chứng được review.

Để tránh hai hướng dẫn mâu thuẫn, file này làm đầu mối cho trạng thái chạy/bàn giao, còn deployment diagram giữ vai trò thiết kế. Khi triển khai thật, bổ sung các giá trị đã xác minh và link evidence tại đây; không chép một bản vận hành độc lập từ tài liệu kiến trúc.

## Checklist cho production handoff

| Hạng mục | Trạng thái / owner |
|---|---|
| Image / registry / release pipeline | Pending — @tp9951819-cell, [#24](https://github.com/mhien06/SWE_A2/issues/24) |
| HTTPS, cấu hình VPS/cloud và production URL | Pending — @mhien06, @tp9951819-cell, [#25](https://github.com/mhien06/SWE_A2/issues/25) |
| Migration/seed an toàn và rollback | Pending — phối hợp @computerbotver2 [#23](https://github.com/mhien06/SWE_A2/issues/23), @tp9951819-cell [#24](https://github.com/mhien06/SWE_A2/issues/24), @mhien06 [#25](https://github.com/mhien06/SWE_A2/issues/25) |
| `GET /health` và smoke check trên môi trường đã deploy | Pending — @computerbotver2 [#23](https://github.com/mhien06/SWE_A2/issues/23), @mhien06 [#25](https://github.com/mhien06/SWE_A2/issues/25) |
| Logs, secrets và quyền truy cập | Pending verification trong [#25](https://github.com/mhien06/SWE_A2/issues/25); không ghi secret thật vào repo/tài liệu |
| Hướng dẫn vận hành/rollback đã chạy thử | Pending — @mhien06, @tp9951819-cell, [#25](https://github.com/mhien06/SWE_A2/issues/25) |

