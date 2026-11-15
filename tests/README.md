# Kiểm thử tích hợp và E2E (`tests/`)

Thư mục này chứa các bài kiểm thử tích hợp liên ứng dụng và kiểm thử đầu-cuối (End-to-End) cho hệ thống **BrewLite** theo cấu trúc repository tại mục 9 của đề bài và `ADR-001`:

- **Unit test / Component test từng ứng dụng:** đặt trực tiếp trong `apps/api/` (`src/**/*.spec.ts`, `test/`) và `apps/web/`.
- **Integration / E2E test toàn luồng (Task 4.3, Task 5.2):** đặt tại `tests/` để kiểm chứng luồng nghiệp vụ từ xem menu đến đặt đơn, thanh toán và xác nhận đơn (`TC-1.3-01` – `TC-1.3-15`).
