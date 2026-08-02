# Danh Sách Tính Năng App Quản Lí Chi Tiêu

Tài liệu này liệt kê các tính năng đang có trong app theo hướng `page -> quỹ/tab -> menu/action`, đối chiếu từ code hiện tại. File này chỉ mô tả tính năng, không thay đổi logic app.

## Ghi Chú Trạng Thái Hiện Tại

- Đã gỡ khỏi UI các tính năng: `Xem nguồn tiền`, `Đối soát`, `Sức khỏe dữ liệu`, `Kế hoạch phân bổ`.
- Tab `Tài sản -> CK -> Sự kiện cổ phiếu` hiện dùng theo kiểu áp dụng thủ công trực tiếp, không tạo/sửa/hủy event chờ nhận.
- Cổ tức tiền mặt mặc định 10% mệnh giá 10.000đ/cp, thuế mặc định 5%; app tự tính tiền/cp, tiền nhận và kết quả dự kiến, cho phép sửa kết quả trước khi xác nhận.
- Cổ tức cổ phiếu và quyền mua mặc định tỷ lệ 10:1, dùng số cổ đang giữ để tính số cổ nhận hoặc số cổ được mua.
- Quyền mua cộng thêm số cổ mới và chi phí mua vào giá vốn để tính lại giá vốn trung bình.

## Tổng Quan App

- App quản lý thu nhập, chi tiêu, chia quỹ cuối tháng, tài sản đầu tư, sổ MBB, mục tiêu tích lũy và báo cáo tổng tài sản.
- Menu chính đang dùng:
  - `Dashboard`
  - `Báo cáo`
  - `Tài sản`
  - `Tích lũy`
  - `Cài đặt`
- Các quỹ phân bổ tháng:
  - `Crypto/BTC`
  - `CK`
  - `Quỹ tiết kiệm`
  - `Quỹ dự phòng`
- Các nhóm tài sản trong trang `Tài sản`:
  - `Crypto`: BTC, USDT, SOL
  - `CK`: cổ phiếu và tiền dư CK
  - `Sổ MB`: Tiết kiệm, Dự phòng, Tích lũy
- Tính năng nền:
  - Mở app bằng mã PIN.
  - Trang `/admin` để tạo tài khoản PIN mới hoặc đổi PIN bằng mật khẩu admin.
  - Lưu dữ liệu local bằng `localStorage`.
  - Đồng bộ dữ liệu cloud qua Supabase nếu có cấu hình.
  - Đồng bộ riêng BTC ledger gồm mua USDT, kế hoạch DCA, lệnh mua BTC, lệnh rút/chuyển BTC.
  - PWA: manifest, icon app, chế độ standalone, service worker cache app shell và hỗ trợ mở lại khi mất mạng.
  - Undo theo phiên làm việc.
  - Thùng rác 30 ngày.
  - Audit log lịch sử thao tác.
  - Backup JSON, restore JSON, export CSV.

## Page: Dashboard

### Tổng Quan Tháng

- Mặc định mở tháng hiện tại.
- Có điều khiển chuyển tháng trước/sau.
- Hiển thị tổng thu nhập của tháng.
- Hiển thị tổng chi tiêu của tháng.
- Hiển thị số tiền có thể chia quỹ.
- Tính tiết kiệm tháng theo thu nhập trừ chi tiêu.
- Có rule theo dõi:
  - Tiết kiệm tháng tối thiểu 10% thu nhập.
  - Chi tiêu tháng tối đa 60% thu nhập.
- Hiển thị danh sách việc cần xử lý trong mục `Hôm nay cần làm gì`.

### Thu Nhập

- Xem tổng thu nhập theo tháng.
- Xem danh sách mục thu nhập có phát sinh.
- Xem tỷ trọng từng mục thu nhập.
- Mở chi tiết thu nhập theo từng mục.
- Thêm khoản thu với:
  - Mục thu
  - Số tiền
  - Ngày
  - Ghi chú
- Thêm mục thu nhập mới.
- Chọn loại mục thu:
  - `Phát sinh`
  - `Cố định`
- Sửa giao dịch thu nhập.
- Xóa giao dịch thu nhập.
- Giao dịch thu nhập bị xóa được đưa vào thùng rác.
- Các thao tác thêm, sửa, xóa thu nhập có thể được undo nếu được ghi qua luồng undo.

### Chi Tiêu

- Xem tổng chi tiêu theo tháng.
- Xem danh sách mục chi tiêu có phát sinh.
- Xem tỷ trọng từng mục chi tiêu.
- Mở chi tiết chi tiêu theo từng mục.
- Thêm khoản chi với:
  - Mục chi
  - Số tiền
  - Ngày
  - Ghi chú
- Thêm mục chi mới.
- Chọn loại mục chi:
  - `Phát sinh`
  - `Cố định`
- Sửa giao dịch chi tiêu.
- Xóa giao dịch chi tiêu.
- Giao dịch chi tiêu bị xóa được đưa vào thùng rác.
- Các thao tác thêm, sửa, xóa chi tiêu có thể được undo nếu được ghi qua luồng undo.

### Checklist Khoản Cố Định

- Hiển thị các khoản chi cố định của tháng.
- Tick khoản cố định là `Đã chuyển`.
- Bỏ tick khoản cố định về trạng thái chưa chuyển.
- Khoản cố định chỉ được tính vào chi tiêu khi đã tick.
- Sửa số tiền khoản cố định cho tháng đang xem.
- Xóa mục chi cố định nếu mục đó không bị khóa bởi mục tích lũy.
- Khi xóa mục chi cố định, app xóa kèm các monthly expense và khoản phát sinh liên quan, đồng thời đưa dữ liệu vào thùng rác.

### Chia Quỹ Cuối Tháng

- Hiển thị 4 quỹ được chia:
  - `BTC/Crypto`
  - `CK`
  - `Quỹ tiết kiệm`
  - `Dự phòng`
- Chỉnh tỷ lệ phần trăm cho từng quỹ.
- Chỉnh số tiền cụ thể cho từng quỹ.
- Reset số tiền chia về công thức theo tỷ lệ phần trăm.
- Validate tổng tỷ lệ phải bằng 100%.
- Validate tổng tiền chia phải khớp số tiền có thể chia quỹ.
- Chọn tháng chia quỹ.
- Mở modal xác nhận chia quỹ.
- Xác nhận chia quỹ bằng nút `Đồng ý chia quỹ`.
- Chặn xác nhận nếu tháng đã được chia quỹ.
- Chặn xác nhận nếu tổng tỷ lệ sai, tổng tiền sai hoặc không có tiền tiết kiệm để chia.
- Khi xác nhận:
  - Lưu snapshot số tiền chia cho từng quỹ.
  - Ghi giao dịch nạp vào quỹ `BTC/Crypto`.
  - Ghi giao dịch nạp vào quỹ `CK`.
  - Đánh dấu phần `Quỹ tiết kiệm` là chờ tạo sổ MBB.
  - Đánh dấu phần `Dự phòng` là chờ tạo sổ MBB.
- Nếu chưa chỉnh số tiền tay, phần lẻ sau khi làm tròn bội số chứng chỉ tiền gửi được cộng vào BTC.

### Hôm Nay Cần Làm Gì

- Nhắc khi tháng hiện tại chưa chia quỹ.
- Nhắc khi tiền chia quỹ chưa tạo sổ MBB.
- Nhắc khi tiền SOL chuyển về Tiết kiệm/Dự phòng chưa tạo sổ.
- Nhắc khi tiền CK chuyển về Tiết kiệm/Dự phòng chưa tạo sổ.
- Nhắc khi tiền BTC/USDT chuyển về Tiết kiệm/Dự phòng chưa tạo sổ.
- Nhắc khi có sổ MBB sắp đáo hạn.
- Nhắc khi còn VND trong quỹ Crypto chưa mua USDT.
- Nhắc khi tiền từ SOL hoặc BTC chuyển về CK nhưng chưa mua cổ phiếu.
- Nhắc khi tiền chia vào CK nhưng chưa mua cổ phiếu.
- Nhắc khi USDT chỉ còn đủ chạy DCA dưới 5 ngày.
- Nhắc khi giá thị trường cần cập nhật.
- Bấm việc cần làm sẽ điều hướng tới đúng page/tab/action tương ứng.

## Page: Tài Sản

Trang `Tài sản` có các tab:

- `Crypto`
- `CK`
- `Sổ MB`

Trang có nút cập nhật giá chung cho BTC, CK và SOL. Khi cập nhật thành công sẽ hiện trạng thái `Đã cập nhật`.

### Tab: Crypto

#### Tổng Quan Crypto

- Hiển thị tổng tài sản Crypto.
- Hiển thị vốn Crypto.
- Hiển thị lãi/lỗ Crypto theo VND và phần trăm.
- Hiển thị số dư từng tài sản:
  - BTC
  - SOL
  - USDT
- Hiển thị giá trị quy VND của từng tài sản.
- Hiển thị thông báo khi có tiền mới được chia vào quỹ Crypto.
- Cho phép ẩn thông báo tiền chia vào Crypto.

#### Giá Thị Trường Crypto

- Cập nhật giá BTC/USDT.
- Cập nhật giá SOL/USDT.
- Cập nhật tỷ giá USDT/VND.
- Hiển thị giá trung bình BTC.
- Hiển thị giá trung bình SOL.
- Tự động cập nhật giá theo chu kỳ.
- Nếu không cập nhật được giá, app giữ giá cuối cùng đã lưu.

#### Mua USDT

- Mở form mua USDT.
- Nhập VND dùng mua.
- Nhập USDT thực nhận.
- Tự ước tính USDT nhận theo tỷ giá.
- Hiển thị giá USDT/VND tự tính.
- Nhập ngày mua.
- Nhập note.
- Lưu giao dịch mua USDT.
- Chặn lưu nếu VND hoặc USDT không hợp lệ.
- Chặn lưu nếu VND mua USDT lớn hơn vốn Crypto chưa đổi.
- Đồng bộ giao dịch mua USDT lên BTC cloud ledger nếu có tài khoản cloud.

#### DCA BTC

- Tạo kế hoạch DCA BTC.
- Nhập USDT mỗi kỳ.
- Chọn tần suất:
  - Hàng ngày
  - Hàng tuần
  - Hàng tháng
- Nhập giờ chạy.
- Nhập ngày bắt đầu.
- Lưu kế hoạch DCA.
- Sửa kế hoạch DCA.
- Tạm dừng kế hoạch DCA.
- Bật lại kế hoạch DCA.
- Xóa kế hoạch DCA.
- Khi xóa kế hoạch DCA, các giao dịch DCA liên quan cũng bị xóa khỏi Crypto và hoàn lại USDT vào số dư tính toán.
- Kế hoạch DCA bị xóa được đưa vào thùng rác kèm giao dịch DCA liên quan.
- Xem danh sách DCA đang chạy.
- Xem chi tiết DCA:
  - Số lượng BTC nắm giữ
  - Giá trị hiện tại
  - Ngày bắt đầu
  - Giao dịch tiếp theo
  - Giá gần nhất
  - Giá trung bình
  - Lãi/lỗ USDT và phần trăm
- Sửa số BTC tích lũy và giá trung bình của DCA.
- Xem lịch sử giao dịch DCA của từng kế hoạch.
- Import DCA cũ với:
  - USDT mỗi kỳ
  - Tần suất
  - Giờ chạy
  - Ngày bắt đầu
  - Ngày giao dịch tiếp theo
  - Số kỳ đã kích hoạt
  - BTC tích lũy
  - Giá gần nhất
  - Giá trung bình
  - Note
- Khi import DCA cũ, app tạo kế hoạch DCA và lịch sử giao dịch DCA tương ứng.
- Đồng bộ kế hoạch DCA và giao dịch DCA lên BTC cloud ledger nếu có tài khoản cloud.

#### Mua SOL

- Mở form mua SOL.
- Nhập số SOL.
- Nhập giá mua USDT.
- Giá mua có thể tự lấy từ giá SOL hiện tại.
- Nhập ngày mua.
- Nhập note.
- Lưu giao dịch mua SOL.
- Chặn lưu nếu số SOL hoặc giá mua không hợp lệ.

#### Rút / Chuyển Crypto

- Mở form rút/chuyển Crypto.
- Chọn tài sản nguồn:
  - BTC
  - USDT
  - SOL
- Có nút `Max` để điền tối đa theo số dư đang có.
- Nhập giá theo tài sản nguồn và nơi nhận:
  - BTC/USDT
  - USDT/VND
  - SOL/USDT
- Nhập số tiền nhận.
- App tự ước tính số tiền nhận nếu để trống.
- Nhập ngày.
- Nhập note.
- Lưu giao dịch rút/chuyển.

Luồng chuyển BTC:

- BTC chỉ được chuyển sang USDT trong quỹ Crypto.
- Chặn chuyển BTC nếu số BTC lớn hơn số đang có.
- Khi chuyển BTC sang USDT, app ghi lịch sử chuyển BTC.
- Không tạo giao dịch rút quỹ VND khi chỉ đổi BTC sang USDT nội bộ.

Luồng chuyển USDT:

- USDT có thể chuyển sang BTC.
- USDT có thể rút/chuyển sang:
  - CK
  - Tiết kiệm
  - Dự phòng
  - Tiền mặt
- Chặn chuyển USDT nếu số USDT lớn hơn số dư USDT.
- Khi USDT chuyển sang BTC, app tạo lệnh mua BTC thủ công.
- Khi USDT chuyển sang CK, app ghi:
  - Giao dịch rút khỏi quỹ Crypto.
  - Giao dịch nạp vào quỹ CK.
- Khi USDT chuyển sang Tiết kiệm hoặc Dự phòng, app ghi giao dịch rút khỏi Crypto và tạo khoản chờ tạo sổ MBB.
- Khi USDT chuyển sang Tiền mặt, app ghi giao dịch rút khỏi Crypto và ghi thu nhập khác.

Luồng chuyển SOL:

- SOL có thể chuyển sang BTC qua USDT.
- SOL có thể mua BTC trực tiếp.
- SOL có thể chuyển sang:
  - CK
  - Tiết kiệm
  - Dự phòng
  - Tiền mặt
- Chặn rút SOL nếu số SOL lớn hơn số đang có.
- Khi SOL chuyển sang BTC qua USDT, app tạo giao dịch mua USDT từ SOL.
- Khi SOL mua BTC trực tiếp, app tạo lệnh mua BTC thủ công kèm marker liên kết.
- Khi SOL chuyển sang CK, app ghi giao dịch nạp vào quỹ CK.
- Khi SOL chuyển sang Tiết kiệm hoặc Dự phòng, app tạo khoản chờ tạo sổ MBB.
- Khi SOL chuyển sang Tiền mặt, app ghi thu nhập khác.

#### Lịch Sử Crypto

- Hiển thị lịch sử mua USDT.
- Hiển thị lịch sử mua BTC thủ công và DCA.
- Hiển thị lịch sử rút/chuyển BTC/USDT.
- Hiển thị lịch sử thêm SOL.
- Hiển thị lịch sử rút/chuyển SOL.
- Xóa lịch sử Crypto.
- Khi xóa, dữ liệu được đưa vào thùng rác.
- Khi xóa giao dịch có dữ liệu liên quan, app xóa kèm dữ liệu liên quan:
  - DCA và các trade DCA
  - BTC transfer và fund transaction liên quan
  - SOL withdrawal và BTC topup/BTC trade/fund transaction/income liên quan

### Tab: CK

#### Tổng Quan CK

- Hiển thị tổng vốn CK đã được chia.
- Hiển thị tổng tài sản CK.
- Hiển thị tiền dư trong quỹ CK.
- Hiển thị lãi/lỗ CK theo VND và phần trăm.
- Hiển thị thông báo khi có tiền mới được chia vào quỹ CK.
- Cho phép ẩn thông báo tiền chia vào CK.

#### Mua Cổ Phiếu

- Mở form mua cổ phiếu.
- Mua nhiều mã cổ phiếu trong một lệnh.
- Mỗi dòng mua có:
  - Mã cổ phiếu
  - Tỷ lệ phần trăm vốn
  - Giá vào
  - Số cổ phiếu
  - Giá trị dòng
- Thêm dòng mua.
- Xóa dòng mua.
- Tự phân bổ lại tỷ lệ khi thêm/xóa dòng.
- Tự tính số cổ theo phần trăm vốn và giá.
- Có nút `Max` để dùng tối đa tiền còn lại cho dòng mua.
- Gợi ý mã cổ phiếu theo dữ liệu VNDIRECT.
- Tự lấy giá cổ phiếu từ VPS/VNDIRECT khi có thể.
- Cho phép nhập giá mua thủ công.
- Nhập ngày mua.
- Lưu lệnh mua cổ phiếu.
- Chặn lưu nếu không có dòng hợp lệ.
- Chặn lưu nếu tổng giá trị mua vượt tiền dư CK.

#### Danh Mục Cổ Phiếu

- Hiển thị từng mã cổ phiếu đang giữ.
- Hiển thị số cổ.
- Hiển thị nguồn giá và thời điểm cập nhật.
- Nếu chưa có giá thị trường, dùng giá vốn.
- Hiển thị giá thị trường và giá vốn trung bình.
- Cho phép sửa giá thị trường thủ công.
- Hiển thị vốn, giá trị thị trường, lãi/lỗ và phần trăm.
- Cập nhật giá thị trường cho các mã đang giữ.

#### Rút / Chuyển CK

- Mở form rút từ từng mã đang giữ.
- Chọn mã đang giữ.
- Nhập số cổ phiếu rút.
- Có nút `Max` để rút tối đa số cổ đang có.
- Nhập giá rút.
- Tự tính giá trị rút VND.
- Chọn nơi nhận:
  - CK
  - BTC
  - Tiết kiệm
  - Dự phòng
  - Tiền mặt
- Nhập ngày.
- Nhập note.
- Lưu lệnh rút/chuyển CK.
- Chặn rút nếu số cổ phiếu lớn hơn số đang có.
- Khi rút về BTC, app ghi giao dịch nạp vào quỹ Crypto/BTC.
- Khi rút về Tiết kiệm hoặc Dự phòng, app tạo khoản chờ tạo sổ MBB.
- Khi rút về Tiền mặt, app ghi thu nhập khác.

#### Lịch Sử CK

- Hiển thị lịch sử mua cổ phiếu.
- Mỗi lệnh mua hiển thị tổng giá trị, ngày, mã, số cổ, giá mua và note.
- Xóa lệnh mua CK.
- Lệnh mua CK bị xóa được đưa vào thùng rác.
- Danh mục CK được tính lại sau khi xóa lịch sử mua.

### Tab: Sổ MB

#### Lọc Và Tổng Quan Sổ

- Lọc sổ theo:
  - Tổng
  - Tiết kiệm
  - Dự phòng
  - Tích lũy
- Khi lọc `Tích lũy`, có thể lọc tiếp theo từng mục tích lũy.
- Hiển thị tổng gốc đang hoạt động của:
  - Tiết kiệm
  - Dự phòng
  - Tích lũy
- Bấm metric từng quỹ để lọc danh sách sổ.

#### Tiền Chờ Tạo Sổ

- Hiển thị banner tiền chia quỹ chưa tạo sổ.
- Hiển thị banner tiền SOL chuyển về Tiết kiệm/Dự phòng chưa tạo sổ.
- Hiển thị banner tiền CK chuyển về Tiết kiệm/Dự phòng chưa tạo sổ.
- Hiển thị banner tiền BTC/USDT chuyển về Tiết kiệm/Dự phòng chưa tạo sổ.
- Bấm banner để mở form tạo sổ đã điền sẵn:
  - Quỹ nhận
  - Số tiền
  - Ngày gửi mặc định hôm nay
  - Tháng nguồn
  - Note liên kết nguồn
- Khi tạo sổ từ chia quỹ, app đánh dấu tháng đó đã tạo sổ cho Tiết kiệm hoặc Dự phòng.
- Khi tạo sổ từ SOL, app lưu liên kết tới lệnh rút SOL.

#### Tạo Sổ MBB

- Mở form tạo sổ.
- Chọn loại sổ/quỹ:
  - Tiết kiệm
  - Dự phòng
  - Tích lũy
- Chọn sản phẩm:
  - Tiền gửi
  - CCTG
- Với CCTG, nhập:
  - Số tiền đã thanh toán
  - Giá trị cuối kỳ MB
- Với sổ Tích lũy, chọn mục tích lũy liên kết.
- Nhập số tiền gốc.
- Nhập ngày gửi.
- Nhập kỳ hạn tháng.
- Tự tính ngày đáo hạn theo ngày gửi và kỳ hạn.
- Cho phép sửa ngày đáo hạn thủ công.
- Nhập lãi suất phần trăm/năm.
- Nhập note.
- Lưu sổ MBB.
- Tự sinh mã sổ theo quỹ:
  - `TK-xx` cho Tiết kiệm
  - `DP-xx` cho Dự phòng
  - `TL-xx` cho Tích lũy
- Nhập/sửa 4 số cuối sổ MB trên card sổ.
- Đổi sản phẩm sổ ngay trên card.

#### Theo Dõi Và Xử Lý Sổ

- Hiển thị trạng thái sổ:
  - Đang gửi
  - Đã quay vòng gốc
  - Đã quay vòng gốc + lãi
  - Đã tất toán
  - Tất toán trước hạn
  - Đã đáo hạn - Chưa xử lý
- Hiển thị ngày gửi.
- Hiển thị ngày đáo hạn.
- Hiển thị kỳ hạn tháng.
- Hiển thị lãi suất/năm.
- Tính lãi cuối kỳ.
- Hiển thị tiến độ sổ.
- Hiển thị số ngày còn lại.
- Hiển thị lãi tích lũy theo tiến độ.
- Highlight sổ sắp đáo hạn:
  - Còn 30 ngày hoặc ít hơn: cảnh báo.
  - Còn 7 ngày hoặc ít hơn: nguy hiểm.
- Khi sổ đáo hạn:
  - Tạo sổ mới từ sổ cũ.
  - Rút toàn bộ.
- Khi tạo sổ mới từ sổ đáo hạn:
  - App mở form với số tiền gốc + lãi.
  - Giữ quỹ, sản phẩm, kỳ hạn, lãi suất theo sổ cũ.
  - Liên kết sổ cha và sổ con.
  - Đánh dấu sổ cũ đã tất toán khi lưu sổ mới.
- Tất toán trước hạn:
  - Chọn ngày tất toán.
  - Lãi mặc định bằng 0 theo logic nhận lại gốc.
  - Đánh dấu trạng thái `Tất toán trước hạn`.
- Xóa sổ MBB.
- Sổ bị xóa được đưa vào thùng rác.
- Khi xóa sổ có liên kết cha/con, app gỡ hoặc khôi phục liên kết phù hợp trong các sổ còn lại.

## Page: Tích Lũy

### Danh Sách Mục Tích Lũy

- Hiển thị các mục tích lũy đang hoạt động.
- Hiển thị mục tiêu tiền.
- Hiển thị số tiền đã tích lũy.
- Hiển thị phần trăm tiến độ.
- Hiển thị số tiền còn cần dồn.
- Hiển thị số tháng dự kiến còn lại.
- Hiển thị ngày cần dùng nếu có.
- Hiển thị tháng bắt đầu nếu không có ngày cần dùng.
- Mở nhanh sổ MBB của từng mục tích lũy.

### Tạo Mục Tích Lũy

- Mở form tạo mục tích lũy.
- Nhập tên mục.
- Nhập tổng tiền cần dồn.
- Nhập tháng bắt đầu.
- Nhập ngày cần dùng.
- Nhập số tháng.
- Nhập tiền mỗi tháng.
- Tự tính kế hoạch theo ngày cần dùng.
- Tự tính tiền mỗi tháng khi nhập số tháng.
- Tự tính số tháng khi nhập tiền mỗi tháng.
- Hiển thị phần tính toán:
  - Còn cần dồn
  - Số tháng
  - Tiền mỗi tháng
- Khi tạo mục, app tạo mục chi cố định liên kết với checklist khoản cố định.
- App tự tạo monthly expense cho kế hoạch tích lũy.

### Sửa / Kết Thúc / Xóa Mục Tích Lũy

- Sửa mục tích lũy.
- Khi sửa, app giữ tiến độ đã tick và tính lại phần còn lại.
- Kết thúc mục tích lũy.
- Khi kết thúc, checklist từ tháng sau không còn hiển thị mục đó.
- Xóa mục tích lũy.
- Khi xóa, app giữ các tháng đã tick trong báo cáo cũ.
- Mục tích lũy bị xóa được đưa vào thùng rác cùng dữ liệu liên quan.
- Xem lịch sử các mục tích lũy đã kết thúc.

## Page: Báo Cáo

### Tổng Tài Sản

- Hiển thị tổng tài sản hiện tại.
- Hiển thị tổng tích lũy ròng.
- Hiển thị lãi/lỗ tổng.
- Tổng tài sản gồm:
  - Crypto/BTC
  - CK
  - Quỹ tiết kiệm
  - Quỹ dự phòng
- Tổng tài sản không tính tiền mặt tự do.
- Crypto trong báo cáo gồm BTC và SOL quy VND.
- Tiết kiệm/Dự phòng trong báo cáo gồm sổ đang hoạt động và tiền chờ tạo sổ từ các luồng chuyển.

### Mục Tiêu Tài Chính

- Tính chi tiêu trung bình theo tháng.
- Tính mục tiêu tự do tài chính bằng chi tiêu trung bình x 300.
- Tính mục tiêu dự phòng bằng chi tiêu trung bình x 6.
- Hiển thị tiến độ đạt tự do tài chính.
- Hiển thị tiến độ đạt dự phòng 6 tháng.

### Biểu Đồ Và Phân Bổ

- Biểu đồ tăng trưởng theo tháng.
- Có thể chọn dữ liệu biểu đồ:
  - Tổng tài sản hiện tại
  - Tổng số tiền tích lũy
  - Crypto
  - CK
  - Quỹ tiết kiệm
  - Quỹ dự phòng
- Tooltip biểu đồ hiển thị breakdown theo tháng.
- Hiển thị chip phân bổ theo quỹ.
- Bấm chip quỹ để đổi biểu đồ sang quỹ đó.
- Hiển thị donut phân bổ quỹ tài chính:
  - Quỹ Đầu tư
  - Quỹ Tiết kiệm
  - Quỹ Dự phòng
- Hiển thị phần trăm phân bổ portfolio.

### Mục Tiêu Tích Lũy Trong Báo Cáo

- Hiển thị tối đa 3 mục tích lũy đang hoạt động.
- Hiển thị tên mục, khoảng tháng, phần trăm tiến độ và số tiền đã dồn/tổng mục tiêu.
- Bấm `Xem tất cả` để mở page `Tích lũy`.

### Lãi / Lỗ Theo Gốc

- Bảng lãi/lỗ theo gốc cho:
  - Tổng
  - Crypto
  - CK
  - Tiết kiệm
  - Dự phòng
- Hiển thị:
  - Gốc đầu tư
  - Giá trị hiện tại
  - Lãi/lỗ
  - Phần trăm lãi/lỗ
- Có drilldown từng dòng:
  - Tổng: chi tiết từng quỹ.
  - Crypto: vốn, VND chờ mua USDT, USDT còn, BTC/SOL đang giữ, BTC/SOL quy VND, lãi/lỗ.
  - CK: vốn CK, tiền mặt CK, giá trị cổ phiếu, giá vốn, lãi/lỗ, từng mã đang giữ.
  - Tiết kiệm/Dự phòng: số sổ đang chạy, gốc sổ, giá trị hiện tại, tiền chờ tạo sổ, lãi/lỗ.
- Có nút cập nhật giá phục vụ báo cáo.

## Page: Cài Đặt

### Dữ Liệu

- Tạo backup JSON.
- Export CSV.
- Restore JSON.
- Trước khi restore JSON, app hỏi xác nhận vì thao tác thay toàn bộ dữ liệu hiện tại.
- Trước khi restore, app tự lưu một bản backup vào localStorage.
- Restore kiểm tra đúng JSON và đúng version backup.
- Sau restore, app chuẩn hóa state theo schema hiện tại.
- Sau restore, app đồng bộ lại cloud và BTC ledger nếu có cấu hình.

### Export CSV

CSV export gồm các nhóm dữ liệu:

- Tổng quan tháng hiện tại.
- Lãi/lỗ theo gốc.
- Danh mục thu nhập.
- Thu nhập.
- Danh mục chi tiêu.
- Chi tiêu phát sinh.
- Checklist khoản cố định.
- Chia quỹ.
- Giao dịch quỹ.
- Crypto - Tổng quan.
- Crypto - Mua USDT.
- Crypto - Kế hoạch DCA BTC.
- Crypto - Lệnh mua BTC.
- Crypto - Rút/chuyển BTC-USDT.
- CK - Tổng quan.
- CK - Danh mục hiện tại.
- CK - Lịch sử mua.
- CK - Lịch sử rút/bán.
- CK - Giá thị trường.
- Crypto - Giao dịch SOL.
- Sổ MBB.
- Tích lũy.
- Thùng rác 30 ngày.
- Lịch sử thao tác.

### Thùng Rác 30 Ngày

- Hiển thị danh sách dữ liệu đã xóa.
- Hiển thị nhãn dữ liệu.
- Hiển thị thời điểm xóa.
- Hiển thị số ngày còn lại trước khi hết hạn.
- Khôi phục dữ liệu từ thùng rác.
- Xóa vĩnh viễn dữ liệu khỏi thùng rác.
- Xác nhận trước khi xóa vĩnh viễn.
- Thùng rác lưu tối đa 300 mục gần nhất.
- Khi khôi phục, app khôi phục cả dữ liệu liên quan nếu trash item có payload liên quan.
- Các loại dữ liệu có thể khôi phục gồm:
  - Thu nhập
  - Chi tiêu
  - Mục chi
  - Mục tích lũy
  - Mua USDT
  - DCA BTC
  - Lệnh mua BTC
  - Rút/chuyển BTC
  - Lệnh mua CK
  - Lệnh rút/bán CK
  - Giao dịch SOL
  - Sổ MBB

### Lịch Sử Thao Tác

- Hiển thị tối đa 50 log gần nhất.
- Hiển thị nội dung thao tác.
- Hiển thị thời điểm thao tác.
- Hiển thị loại dữ liệu.
- Hiển thị action:
  - `create`
  - `update`
  - `delete`
  - `restore`
  - `backup`
  - `undo`
  - `sync`

### PIN, Admin Và Cloud

- Khi chưa mở khóa, app hiển thị màn hình nhập PIN.
- PIN cần tối thiểu 4 số.
- Nếu chưa có PIN local và cloud chưa cấu hình, PIN đầu tiên sẽ được lưu làm PIN local.
- Nếu cloud đã cấu hình, app tải tài khoản theo PIN từ Supabase.
- Nếu tài khoản cloud chưa tồn tại, app hướng dẫn vào `/admin` để tạo PIN.
- Trang `/admin` có đăng nhập bằng mật khẩu admin.
- Sau khi admin unlock:
  - Tạo tài khoản PIN mới.
  - Đổi PIN cho tài khoản hiện có.
- Khi đổi PIN cloud, app lưu dữ liệu sang khóa PIN mới và xóa khóa PIN cũ.
- Cloud snapshot được mã hóa bằng AES-GCM với khóa dẫn xuất từ PIN.
- App tự đồng bộ cloud sau khi state thay đổi.
- App có trạng thái đồng bộ cloud.
- App có khả năng đồng bộ riêng BTC ledger lên các bảng payload cloud.

## Thêm Nhanh / Undo

### Floating Action Button

- Có nút thêm nhanh dạng FAB.
- FAB có thể kéo đến vị trí khác trên màn hình.
- FAB tự giữ trong viewport khi resize.
- Bấm FAB mở modal `Thêm nhanh`.

### Nhóm Thêm Nhanh

- Nhóm `Thu nhập`:
  - Thêm thu nhập.
- Nhóm `Chi tiêu`:
  - Thêm chi tiêu.
- Nhóm `Crypto`:
  - Mua USDT.
  - Tạo DCA.
  - Mua SOL.
  - Rút Crypto.
- Nhóm `CK`:
  - Mua CK.
  - Rút/chuyển CK.
- Nhóm `Sổ MBB`:
  - Tạo sổ.
- Nhóm `Undo`:
  - Hoàn tác.

### Action Nhanh: Thu Nhập

- Chọn mục thu.
- Nhập số tiền.
- Nhập ngày.
- Nhập note.
- Lưu nhanh khoản thu.

### Action Nhanh: Chi Tiêu

- Chọn mục chi.
- Nhập số tiền.
- Nhập ngày.
- Nhập note.
- Lưu nhanh khoản chi.

### Action Nhanh: Crypto

- Mua USDT nhanh với VND, USDT nhận, ngày, note.
- Tạo DCA nhanh với USDT mỗi kỳ, tần suất, giờ chạy, ngày bắt đầu, note.
- Mua SOL nhanh với số SOL, giá mua, ngày, note.
- Rút Crypto nhanh với tài sản nguồn BTC/USDT/SOL, số lượng, giá, số tiền nhận, nơi nhận, ngày, note.
- Rút Crypto nhanh hỗ trợ các nơi nhận giống tab Crypto:
  - BTC sang USDT.
  - USDT sang BTC, CK, Tiết kiệm, Dự phòng, Tiền mặt.
  - SOL sang BTC qua USDT, mua BTC trực tiếp, CK, Tiết kiệm, Dự phòng, Tiền mặt.

### Action Nhanh: CK

- Mua CK nhanh nhiều dòng.
- Chia tỷ lệ phần trăm vốn theo từng dòng.
- Nhập mã, giá vào, số cổ.
- Dùng Max để tính số cổ có thể mua.
- Thêm dòng mua.
- Xóa dòng mua.
- Lưu nhanh lệnh mua CK.
- Rút/chuyển CK nhanh:
  - Chọn mã đang giữ.
  - Nhập số lượng.
  - Dùng Max.
  - Nhập giá rút.
  - Chọn nơi nhận CK/BTC/Tiết kiệm/Dự phòng/Tiền mặt.
  - Nhập ngày và note.

### Action Nhanh: Sổ MBB

- Tạo sổ MBB nhanh.
- Chọn quỹ Tiết kiệm hoặc Dự phòng.
- Chọn sản phẩm Tiền gửi hoặc CCTG.
- Nhập số tiền.
- Với CCTG, nhập số tiền đã thanh toán và giá trị cuối kỳ.
- Nhập lãi suất, kỳ hạn, ngày gửi, 4 số cuối MB và note.

### Undo

- Mỗi thao tác qua `commitWithUndo` lưu lại state trước đó.
- Undo stack giữ tối đa 10 thao tác gần nhất.
- Sau thao tác có undo toast trong 5 giây.
- Bấm `Hoàn tác` trên toast để quay về state trước thao tác.
- Menu `Undo` trong thêm nhanh hiển thị tối đa 10 thao tác gần nhất.
- Nếu undo một thao tác cũ, app cảnh báo rằng các thao tác mới hơn cũng sẽ bị hoàn lại.
- Khi undo, app ghi audit log action `undo`.
- Khi undo ảnh hưởng BTC ledger, app cố đồng bộ lại cloud ledger; nếu lỗi sẽ báo đã hoàn tác local nhưng chưa đồng bộ được BTC cloud.

## Luồng Xóa, Thùng Rác Và Khôi Phục

- Các thao tác xóa quan trọng đều hỏi xác nhận trước.
- Dữ liệu bị xóa được đưa vào thùng rác thay vì mất ngay nếu luồng đó có `withTrashItem`.
- Trash item lưu:
  - Loại dữ liệu
  - ID gốc
  - Nhãn
  - Payload dữ liệu
  - Dữ liệu liên quan nếu có
  - Thời điểm xóa
  - Thời điểm hết hạn
- Khôi phục thùng rác sẽ đưa dữ liệu chính và dữ liệu liên quan trở lại state.
- Xóa vĩnh viễn khỏi thùng rác không khôi phục được.
- Thùng rác tự được normalize để bỏ mục hết hạn khi load state.

## Tính Toán Chính

- Thu nhập tháng lấy từ các giao dịch thu nhập theo tháng.
- Chi tiêu tháng gồm:
  - Khoản cố định đã tick.
  - Khoản phát sinh theo mục chi.
- Chia quỹ tính trên số tiền tiết kiệm tháng.
- Quỹ Tiết kiệm và Dự phòng dạng sổ MBB chỉ tính principal đang hoạt động vào tài sản.
- Lãi MBB dự kiến tính theo công thức: `gốc * lãi suất năm * kỳ hạn tháng / 12`.
- SOL tính giá vốn, số lượng, giá trị hiện tại, lãi/lỗ USDT và quy VND.
- CK tính tiền dư, giá vốn, giá trị thị trường, lãi/lỗ theo danh mục.
- Crypto tính vốn, VND chờ mua USDT, USDT còn, BTC đang giữ, SOL đang giữ và giá trị quy VND.
- Báo cáo tăng trưởng gom dữ liệu theo các tháng từ tháng bắt đầu mặc định `2026-06` đến tháng mới nhất có dữ liệu hoặc tháng hiện tại.

## Ghi Chú Về Page Cũ

- `MoneyPage` còn tồn tại trong code nhưng hiện không được route trực tiếp trong app.
- Các tính năng thu nhập, chi tiêu và chia quỹ của `MoneyPage` đã được liệt kê theo `Dashboard`, vì `Dashboard` là page đang render luồng này trong app hiện tại.
