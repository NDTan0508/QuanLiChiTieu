# Backlog Update.md

File này theo dõi các phần còn thiếu sau khi đã triển khai theo `Update.md`.

## Rollback Theo Phản Hồi Người Dùng

- [x] Gỡ khỏi UI các tính năng `Xem nguồn tiền`, `Đối soát`, `Sức khỏe dữ liệu`, `Kế hoạch phân bổ`.
- [x] Gỡ các section export CSV phục vụ truy nguồn/health/đối soát/allocation plan.
- [x] Đổi `Tài sản -> CK -> Sự kiện cổ phiếu` sang luồng áp dụng thủ công trực tiếp:
  - Cổ tức tiền mặt tính theo số cổ đang giữ và `%` mệnh giá hoặc tiền/cp.
  - Cổ tức cổ phiếu/cổ phiếu thưởng tính số cổ nhận theo tỷ lệ.
  - Quyền mua tính số cổ được mua theo tỷ lệ, kiểm tra tiền dư CK, cộng chi phí vào giá vốn.
  - Vẫn có undo cho sự kiện đã áp dụng.

## P0 - Đã Hoàn Tất

- [x] Thêm `AdjustmentTransaction` cho đối soát.
  - Lưu adjustment riêng trong state, có `meta.eventId`.
  - Financial index sinh event `adjustment`.
  - Reconciliation difference có thể tạo adjustment thủ công.
  - Adjustment không tự sửa dữ liệu gốc, chỉ ghi dòng điều chỉnh liên kết session.
  - Export CSV có section adjustment.

- [x] Gắn `planItemId` vào giao dịch tạo từ Allocation Plan.
  - Mở form hiện có từ plan item đã điền sẵn.
  - Sau khi lưu giao dịch, đánh dấu item `completed`.
  - Tính lại projected snapshot sau từng item.
  - Ghi chú: CK V1 mở form mua và giữ link plan; số tiền plan chưa tự quy đổi thành số cổ nếu người dùng chưa chọn mã/giá.

- [x] Hoàn thiện Health Check rule theo thời gian.
  - Mua BTC vượt USDT theo từng thời điểm.
  - Rút BTC/USDT/SOL vượt số dư theo từng thời điểm.
  - Bán cổ vượt số đang giữ theo từng thời điểm có corporate action.

## P1 - Workflow Hoàn Chỉnh

- [x] Source trace chính xác hơn.
  - [x] Tạo edge chính xác cho transfer có marker: BTC -> fund/income/deposit, CK -> deposit, SOL -> BTC.
  - [x] Tạo edge V1 cho `conversion`, `purchase`, `rollover`, `dividend`, `interest`.
  - [x] Gắn modal cho accumulation cards và report drilldown.
  - [x] Thêm chế độ FIFO V1 khi tiền bị gộp nhiều nguồn.
  - [x] Audit toàn bộ timeline cũ để bảo đảm mọi dòng lịch sử đều có nút trace đúng event.

- [x] Đối soát đầy đủ.
  - [x] Nhập reason/resolution cho từng difference.
  - [x] Tạo adjustment theo từng difference.
  - [x] Mở lại phiên completed và sửa actual balance.
  - [x] Snapshot expected lấy từ financial index thay vì tính rời trong UI.

- [x] Sự kiện cổ phiếu đầy đủ.
  - [x] Sửa sự kiện chưa applied.
  - [x] Hoàn tác sự kiện đã applied bằng action riêng.
  - [x] Cổ tức tiền mặt tạo event tiền dư CK rõ ràng.
  - [x] Quyền mua kiểm tra tiền dư CK trước khi apply.
  - [x] Chống apply hai lần bằng validation và audit.

## P2 - Migration Và Test

- [x] Migration an toàn.
  - [x] Backup trước migration tự động.
  - [x] So sánh tổng tài sản trước/sau migration.
  - [x] Chỉ ghi state khi migration thành công.
  - [x] Chạy Health Check sau migration.

- [x] Test domain.
  - [x] Thêm test runner tương đương bằng Node `node --test`.
  - [x] Test migration metadata version 1 -> 2.
  - [x] Test financial index edge/group.
  - [x] Test Health Check.
  - [x] Test reconciliation adjustment.
  - [x] Test corporate action qua financial index.
  - [x] Test allocation plan.

## P3 - Hạ Tầng Và Tối Ưu

- [ ] Tách dần `App.tsx`.
  - [x] Domain/state helpers ra module riêng.
  - [x] Component dùng chung `SourceTraceModal` ra file riêng.
  - [x] Component điều hướng `AppNav` ra file riêng.
  - [x] Component chỉ số `MetricCard` ra file riêng.
  - [x] Component biểu đồ `BreakdownPie` ra file riêng.
  - [x] Component chọn tháng `MonthPicker` ra file riêng.
  - [x] Page auth/admin `PinGate`, `AdminPage` ra file riêng.
  - [ ] Các page lớn còn lại ra file riêng.
  - [x] Giảm bundle single chunk bằng manual chunks.

- [x] Supabase payload.
  - [x] Đảm bảo các bảng BTC ledger giữ `meta`.
  - [x] Chưa cần thêm table riêng cho health/reconciliation/corporate/allocation cho đến khi snapshot ổn định.
