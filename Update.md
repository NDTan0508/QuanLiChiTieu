# KẾ HOẠCH PHÁT TRIỂN 5 TÍNH NĂNG NÂNG CAO

## 1. Phạm vi thực hiện

Các tính năng sẽ bổ sung:

1. **Tính năng 2:** Trung tâm đối soát tài sản.
2. **Tính năng 4:** Kế hoạch hành động phân bổ tiền tự động.
3. **Tính năng 5:** Theo dõi nguồn gốc từng dòng tiền.
4. **Tính năng 7:** Sự kiện cổ phiếu và điều chỉnh giá vốn tự động.
5. **Tính năng 9:** Bộ kiểm tra sức khỏe dữ liệu.

App hiện có nhiều loại dữ liệu riêng biệt như thu nhập, chi tiêu, giao dịch quỹ, BTC, SOL, cổ phiếu, sổ MBB và mục tiêu tích lũy. Một số giao dịch đã có liên kết với dữ liệu liên quan, nhưng liên kết mới được xử lý riêng trong từng luồng.

Vì vậy, không nên xây 5 tính năng này như 5 module độc lập. Cần xây một lớp dữ liệu lõi dùng chung để:

* Định danh mọi giao dịch.
* Liên kết các giao dịch có cùng nguồn.
* Theo dõi đầu vào và đầu ra.
* Tính số dư thống nhất.
* Phát hiện dữ liệu sai.
* Cho phép truy ngược nguồn gốc.
* Cho phép mô phỏng trước khi thay đổi dữ liệu.

---

# 2. Thứ tự triển khai đề xuất

## Giai đoạn nền tảng

### Bước 1: Chuẩn hóa định danh giao dịch

Mọi bản ghi tài chính cần có ít nhất:

```ts
type TransactionMeta = {
  eventId: string;
  groupId?: string;
  parentEventIds?: string[];
  childEventIds?: string[];
  accountFromId?: string;
  accountToId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: "user" | "system" | "import" | "migration";
  schemaVersion: number;
};
```

Trong đó:

* `eventId`: ID duy nhất của giao dịch.
* `groupId`: nhóm các giao dịch thuộc cùng một hành động.
* `parentEventIds`: các giao dịch tạo ra nguồn tiền.
* `childEventIds`: các giao dịch sử dụng số tiền đó.
* `accountFromId`: nơi tiền đi ra.
* `accountToId`: nơi tiền đi vào.

Ví dụ khi chuyển USDT sang quỹ CK:

```text
Nhóm giao dịch: GROUP-001

USDT withdrawal:
- eventId: EVT-001
- groupId: GROUP-001
- accountFromId: BINANCE-USDT

CK fund deposit:
- eventId: EVT-002
- groupId: GROUP-001
- accountToId: CK-CASH
- parentEventIds: [EVT-001]
```

### Bước 2: Bổ sung danh sách nơi giữ tài sản tối thiểu

Dù chưa triển khai đầy đủ tính năng “tiền đang nằm ở đâu”, Trung tâm đối soát vẫn cần biết người dùng đang đối soát với nguồn nào.

```ts
type FinancialAccount = {
  id: string;
  name: string;
  type:
    | "cash"
    | "bank"
    | "securities"
    | "crypto_exchange"
    | "crypto_wallet"
    | "saving"
    | "other";
  currency?: string;
  isActive: boolean;
};
```

Tài khoản mặc định có thể gồm:

* Tiền mặt.
* MB thanh toán.
* VPS.
* Binance.
* Ví BTC.
* Ví SOL.
* Sổ MBB.
* Tài khoản điều chỉnh.

Không cần tạo một page quản lý tài khoản phức tạp ở giai đoạn đầu. Chỉ cần có danh sách định danh để gắn vào giao dịch và phục vụ đối soát.

### Bước 3: Tạo lớp chỉ mục giao dịch

Không nên quét toàn bộ state nhiều lần trong mỗi page.

Cần tạo một hàm dùng chung:

```ts
buildFinancialIndex(state)
```

Kết quả trả về:

```ts
type FinancialIndex = {
  eventsById: Map<string, FinancialEvent>;
  eventsByGroupId: Map<string, FinancialEvent[]>;
  childrenByEventId: Map<string, FinancialEvent[]>;
  parentsByEventId: Map<string, FinancialEvent[]>;
  eventsByAccountId: Map<string, FinancialEvent[]>;
  eventsByAsset: Map<string, FinancialEvent[]>;
  stockEventsBySymbol: Map<string, FinancialEvent[]>;
};
```

Lớp này sẽ được dùng cho:

* Truy nguồn dòng tiền.
* Đối soát.
* Kiểm tra dữ liệu.
* Tính giá vốn cổ phiếu.
* Tạo kế hoạch phân bổ.
* Xem tác động trước khi sửa hoặc xóa.

### Bước 4: Nâng version dữ liệu

Cần tăng version backup và state schema.

Khi app tải dữ liệu cũ:

1. Phát hiện schema cũ.
2. Tạo `eventId` cho các giao dịch chưa có.
3. Ghép các giao dịch liên quan thành `groupId`.
4. Bổ sung metadata mặc định.
5. Lưu bản backup trước migration.
6. Chạy bộ kiểm tra dữ liệu sau migration.
7. Chỉ ghi đè state khi migration thành công.

App hiện đã có kiểm tra version backup, normalize state và tự tạo backup trước khi restore, nên có thể tái sử dụng cơ chế này cho migration.

---

# 3. TÍNH NĂNG 5 — THEO DÕI NGUỒN GỐC DÒNG TIỀN

Đây là tính năng cần làm đầu tiên.

## 3.1. Mục tiêu

Cho phép người dùng bấm vào một tài sản hoặc giao dịch và biết:

* Tiền đến từ đâu.
* Đã đi qua những quỹ nào.
* Đã chuyển đổi thành tài sản gì.
* Giao dịch nào sử dụng số tiền đó.
* Dữ liệu nào sẽ bị ảnh hưởng nếu sửa hoặc xóa.

## 3.2. Mô hình liên kết

Tạo cấu trúc:

```ts
type MoneyFlowEdge = {
  id: string;
  fromEventId: string;
  toEventId: string;

  amountVnd?: number;
  asset?: "VND" | "USDT" | "BTC" | "SOL" | "STOCK";
  quantity?: number;
  stockSymbol?: string;

  relationType:
    | "transfer"
    | "conversion"
    | "allocation"
    | "purchase"
    | "withdrawal"
    | "dividend"
    | "interest"
    | "rollover"
    | "adjustment";

  method: "direct" | "proportional" | "fifo" | "manual";
  confidence: "exact" | "derived" | "estimated";
};
```

## 3.3. Ba mức độ chính xác

### Chính xác

Dùng khi giao dịch có nguồn rõ ràng.

Ví dụ:

```text
Bán 2 SOL
→ Nhận 55 USDT
→ Dùng 55 USDT mua BTC
```

Hai giao dịch được liên kết trực tiếp.

### Suy ra từ hệ thống

Dùng khi app có đủ dữ liệu để suy ra nhưng người dùng không chọn nguồn thủ công.

Ví dụ:

```text
Rút 3.000.000đ từ CK
→ Tạo sổ dự phòng 3.000.000đ cùng ngày
```

App có thể đề xuất liên kết dựa trên:

* Số tiền.
* Ngày.
* Nơi nhận.
* Note.
* Marker liên kết hiện có.

### Ước tính

Dùng khi tiền đã được gộp chung.

Ví dụ quỹ CK có tiền từ ba nguồn:

```text
2.000.000đ từ chia quỹ tháng 6
3.000.000đ từ bán BTC
1.000.000đ từ cổ tức
```

Sau đó mua cổ phiếu trị giá 4.000.000đ.

Không thể xác định chính xác từng đồng đến từ nguồn nào nếu người dùng không chọn. Khi đó dùng phân bổ tỷ lệ:

```text
33,33% từ chia quỹ
50,00% từ bán BTC
16,67% từ cổ tức
```

UI phải hiển thị rõ đây là kết quả ước tính, không được trình bày như dữ liệu chính xác.

## 3.4. Các luồng cần liên kết trước

### Chia quỹ

```text
Tiền tiết kiệm tháng
→ Crypto
→ CK
→ Tiết kiệm
→ Dự phòng
```

### Crypto

```text
VND trong quỹ Crypto
→ Mua USDT
→ Mua BTC hoặc SOL
→ Rút hoặc chuyển sang quỹ khác
```

### Cổ phiếu

```text
Tiền dư CK
→ Mua cổ phiếu
→ Bán hoặc chuyển
→ Tiết kiệm, Dự phòng, Crypto hoặc Tiền mặt
```

### Sổ MBB

```text
Tiền chờ tạo sổ
→ Sổ MBB
→ Đáo hạn
→ Rút hoặc quay vòng
→ Sổ con
```

### Tích lũy

```text
Khoản chi cố định
→ Tiền tích lũy
→ Sổ MBB liên kết mục tiêu
```

## 3.5. Giao diện đề xuất

### Nút “Xem nguồn tiền”

Thêm vào:

* Card BTC.
* Card SOL.
* Số dư USDT.
* Card cổ phiếu.
* Card sổ MBB.
* Giao dịch quỹ.
* Giao dịch mua bán.
* Mục tiêu tích lũy.

### Màn hình chi tiết

#### Tab Nguồn vào

```text
Tài sản hiện tại: 0,0042 BTC

Nguồn hình thành:
- 0,0014 BTC từ DCA tháng 06/2026
- 0,0021 BTC từ DCA tháng 07/2026
- 0,0007 BTC từ chuyển đổi SOL
```

#### Tab Dòng thời gian

```text
Thu nhập
→ Chia quỹ
→ Mua USDT
→ Mua BTC
→ Chuyển về ví
```

#### Tab Dữ liệu liên quan

* Giao dịch gốc.
* Giao dịch con.
* Giao dịch cùng nhóm.
* Quỹ liên quan.
* Tài sản liên quan.

### Xem tác động trước khi xóa

Khi người dùng xóa giao dịch:

```text
Xóa giao dịch này sẽ ảnh hưởng:

- Số dư USDT.
- 2 giao dịch mua BTC.
- Giá vốn BTC.
- Báo cáo tài sản tháng 07/2026.
- Kết quả đối soát Binance gần nhất.
```

Người dùng có thể:

* Hủy.
* Xóa toàn bộ chuỗi liên quan.
* Chỉ gỡ liên kết.
* Chuyển giao dịch con sang nguồn khác.

## 3.6. Tiêu chí hoàn thành

* Mọi giao dịch mới đều có `eventId`.
* Các luồng chuyển nội bộ đều có `groupId`.
* Có thể truy ngược ít nhất ba cấp cha–con.
* Xem được toàn bộ dữ liệu liên quan trước khi xóa.
* Các liên kết không bị mất sau backup, restore hoặc cloud sync.
* Giao dịch không rõ nguồn được đánh dấu là “chưa xác định” hoặc “ước tính”.
* Không tự động tạo liên kết sai mà không cho người dùng kiểm tra.

---

# 4. TÍNH NĂNG 9 — BỘ KIỂM TRA SỨC KHỎE DỮ LIỆU

Tính năng này nên triển khai ngay sau hệ thống nguồn gốc dòng tiền để kiểm tra dữ liệu cũ và dữ liệu migration.

## 4.1. Mục tiêu

Phát hiện những trường hợp:

* Số dư sai.
* Liên kết giao dịch bị mất.
* Chuyển tiền chỉ có một phía.
* Dữ liệu trùng.
* Tài sản không có nguồn hình thành.
* Dữ liệu cloud và local không đồng nhất.
* Giá vốn hoặc danh mục không khớp lịch sử.

## 4.2. Kiến trúc rule engine

```ts
type HealthIssue = {
  id: string;
  ruleId: string;
  fingerprint: string;

  severity: "critical" | "error" | "warning" | "info";
  scope:
    | "income"
    | "expense"
    | "fund"
    | "crypto"
    | "stock"
    | "mbb"
    | "saving_goal"
    | "cloud"
    | "system";

  title: string;
  description: string;

  relatedEventIds: string[];
  relatedEntityIds: string[];

  canAutoFix: boolean;
  detectedAt: string;
  status: "open" | "ignored" | "resolved";
};
```

Mỗi rule:

```ts
type HealthRule = {
  id: string;
  name: string;
  severity: HealthIssue["severity"];
  run: (
    state: AppState,
    index: FinancialIndex
  ) => HealthIssue[];
};
```

## 4.3. Các nhóm kiểm tra

### Nhóm A — Số dư âm

* Quỹ Crypto âm.
* USDT âm.
* BTC âm.
* SOL âm.
* Tiền dư CK âm.
* Số lượng cổ phiếu âm.
* Quỹ tiết kiệm hoặc dự phòng âm.

### Nhóm B — Vượt số dư

* Mua USDT nhiều hơn VND khả dụng.
* Mua BTC nhiều hơn USDT khả dụng.
* Rút BTC, SOL hoặc USDT lớn hơn số dư.
* Bán cổ phiếu lớn hơn số đang giữ.
* Tạo sổ lớn hơn tiền đang chờ.

### Nhóm C — Giao dịch chuyển thiếu đối ứng

Ví dụ:

```text
Có giao dịch rút 3.000.000đ khỏi Crypto
Nhưng không tìm thấy giao dịch nạp vào CK.
```

Hoặc:

```text
Có tiền chờ tạo sổ Dự phòng
Nhưng không tìm thấy nguồn chuyển tương ứng.
```

### Nhóm D — Dữ liệu không có nguồn

* Sổ MBB không có giao dịch nguồn.
* Cổ phiếu đang giữ nhưng không có lệnh mua.
* BTC đang giữ nhưng không có giao dịch mua.
* Tiền dư CK cao hơn tổng tiền được nạp và tiền bán cổ phiếu.
* Mục tiêu tích lũy có tiến độ nhưng không có khoản đóng góp.

### Nhóm E — Dữ liệu liên kết bị hỏng

* `parentEventId` không tồn tại.
* `childEventId` không tồn tại.
* Sổ cha đã bị xóa nhưng sổ con vẫn giữ liên kết.
* Giao dịch cùng `groupId` nhưng tổng đầu vào và đầu ra không khớp.
* Hai giao dịch liên kết với nhau nhưng khác loại tài sản không hợp lệ.

### Nhóm F — Giao dịch trùng

Xác định giao dịch nghi trùng dựa trên:

* Cùng loại.
* Cùng số tiền.
* Cùng ngày.
* Cùng tài sản.
* Cùng note hoặc nội dung gần giống.
* Được tạo trong khoảng thời gian ngắn.

Không tự xóa. Chỉ hiển thị:

```text
Hai giao dịch có khả năng trùng 92%.
```

### Nhóm G — Chia quỹ sai

* Tổng tỷ lệ không bằng 100%.
* Tổng tiền các quỹ không bằng tiền được chia.
* Tháng đã đánh dấu chia quỹ nhưng thiếu snapshot.
* Snapshot có nhưng thiếu giao dịch quỹ.
* Tháng chưa chia nhưng đã có giao dịch đánh dấu nguồn chia quỹ.

### Nhóm H — Sổ MBB

* Sổ đã quá ngày đáo hạn nhưng vẫn là “Đang gửi”.
* Sổ đã tất toán nhưng vẫn tính vào tài sản.
* Sổ con đã tạo nhưng sổ cha chưa tất toán.
* Sổ cha có nhiều sổ con không hợp lệ.
* Giá trị cuối kỳ thấp hơn tiền thanh toán đối với CCTG.
* Ngày đáo hạn nhỏ hơn ngày gửi.

### Nhóm I — Cổ phiếu

* Giá vốn âm hoặc bằng 0 trong khi đang có cổ phiếu.
* Số cổ phiếu tính từ lịch sử khác số cổ trong portfolio.
* Giao dịch bán không có giá bán.
* Sự kiện cổ phiếu đã áp dụng hai lần.
* Cổ tức tính trên sai số lượng cổ phiếu tại ngày chốt quyền.

### Nhóm J — Giá thị trường

* Giá BTC quá cũ.
* Giá SOL quá cũ.
* Tỷ giá USDT/VND quá cũ.
* Giá cổ phiếu quá cũ.
* Nguồn giá thất bại liên tục.
* Giá mới chênh lệch bất thường so với giá trước.

### Nhóm K — Cloud và backup

* Local state mới hơn cloud nhưng chưa sync.
* Cloud state mới hơn local.
* Lần sync gần nhất thất bại.
* BTC ledger cloud thiếu giao dịch đang có ở local.
* Có dữ liệu cloud nhưng không có trong snapshot chính.

App hiện đã có audit log với các action create, update, delete, restore, backup, undo và sync, nên có thể dùng log để xác định thao tác gần nhất gây ra vấn đề.

## 4.4. Mức độ lỗi

### Critical

Có khả năng làm sai tổng tài sản hoặc mất dữ liệu.

Ví dụ:

* Số dư âm.
* Thiếu giao dịch đối ứng.
* Mất liên kết sổ cha–con.
* Lỗi migration.

### Error

Dữ liệu chắc chắn không hợp lệ nhưng chưa làm mất toàn bộ hệ thống.

### Warning

Dữ liệu có dấu hiệu bất thường và cần người dùng kiểm tra.

### Info

Thông tin nên cập nhật nhưng chưa ảnh hưởng tính toán.

## 4.5. Giao diện Trung tâm sức khỏe dữ liệu

Hiển thị:

```text
Sức khỏe dữ liệu: 82/100

Nghiêm trọng: 1
Lỗi: 2
Cảnh báo: 4
Thông tin: 3
```

Không nên coi điểm số là tính năng chính. Phần quan trọng là danh sách lỗi và hành động xử lý.

Mỗi lỗi có:

* Tên lỗi.
* Nguyên nhân.
* Dữ liệu liên quan.
* Giá trị đang sai.
* Giá trị hệ thống đề xuất.
* Nút đi đến giao dịch.
* Nút sửa.
* Nút bỏ qua.
* Nút đánh dấu hợp lệ.

## 4.6. Auto-fix

Chia thành hai loại.

### Sửa an toàn

Có thể tự động thực hiện:

* Xóa liên kết đến ID không tồn tại.
* Cập nhật trạng thái sổ đã đáo hạn.
* Tạo lại chỉ mục.
* Normalize dữ liệu thiếu field mặc định.
* Gộp giá trị làm tròn rất nhỏ.

### Sửa cần xác nhận

* Tạo giao dịch đối ứng.
* Điều chỉnh số dư.
* Xóa giao dịch trùng.
* Tính lại giá vốn.
* Thay đổi nguồn tiền.
* Gỡ một sự kiện cổ phiếu đã áp dụng.

Mọi auto-fix phải đi qua:

```ts
commitWithUndo(...)
```

Sau khi sửa:

* Ghi audit log.
* Cho phép undo.
* Chạy lại rule liên quan.
* Đồng bộ cloud.
* Cập nhật báo cáo.

## 4.7. Thời điểm chạy kiểm tra

* Khi mở app.
* Sau restore.
* Sau migration.
* Sau khi xóa dữ liệu.
* Sau khi sửa liên kết nguồn tiền.
* Sau khi áp dụng sự kiện cổ phiếu.
* Sau khi đối soát.
* Khi người dùng bấm “Kiểm tra toàn bộ”.

Không nên chạy toàn bộ rule sau mỗi lần gõ input. Sau một giao dịch, chỉ chạy rule liên quan và debounce quá trình kiểm tra.

## 4.8. Tiêu chí hoàn thành

* Mỗi lỗi có fingerprint ổn định.
* Lỗi đã bỏ qua không xuất hiện lại nếu dữ liệu không thay đổi.
* Nếu dữ liệu gây lỗi thay đổi, lỗi phải xuất hiện lại.
* Auto-fix có preview trước khi áp dụng.
* Auto-fix có thể undo.
* Không sửa số tiền hoặc số lượng tài sản mà không xác nhận.
* Sau migration, không còn lỗi critical.
* Tổng tài sản trước và sau migration phải khớp, ngoại trừ sai lệch được báo rõ.

---

# 5. TÍNH NĂNG 2 — TRUNG TÂM ĐỐI SOÁT TÀI SẢN

## 5.1. Mục tiêu

Cho phép so sánh:

```text
Số dư app tính
với
Số dư thực tế trên ngân hàng, sàn, ví hoặc tài khoản chứng khoán
```

## 5.2. Đơn vị đối soát

### Tiền mặt và ngân hàng

* VND.
* Ngoại tệ nếu có.

### Crypto

* BTC.
* USDT.
* SOL.

### Cổ phiếu

* Tiền dư CK.
* Số lượng từng mã cổ phiếu.
* Tiền chờ về.
* Cổ tức chờ nhận.

### Sổ MBB

* Danh sách sổ đang hoạt động.
* Số tiền gốc.
* Ngày đáo hạn.
* Trạng thái.
* Bốn số cuối sổ.

## 5.3. Cấu trúc dữ liệu

```ts
type ReconciliationSession = {
  id: string;
  accountId: string;
  reconciliationDate: string;

  status: "draft" | "completed" | "reopened";

  expectedBalances: ReconciliationBalance[];
  actualBalances: ReconciliationBalance[];
  differences: ReconciliationDifference[];

  notes?: string;
  createdAt: string;
  completedAt?: string;
};
```

```ts
type ReconciliationBalance = {
  asset: string;
  stockSymbol?: string;
  amountVnd?: number;
  quantity?: number;
};
```

```ts
type ReconciliationDifference = {
  asset: string;
  stockSymbol?: string;

  expectedAmount?: number;
  actualAmount?: number;
  differenceAmount?: number;

  expectedQuantity?: number;
  actualQuantity?: number;
  differenceQuantity?: number;

  reason?:
    | "missing_transaction"
    | "fee"
    | "interest"
    | "dividend"
    | "rounding"
    | "wrong_price"
    | "manual_adjustment"
    | "unknown";

  resolutionStatus:
    | "unresolved"
    | "transaction_created"
    | "adjusted"
    | "accepted";
};
```

## 5.4. Luồng đối soát

### Bước 1: Chọn nơi đối soát

Ví dụ:

* MB thanh toán.
* Binance.
* VPS.
* Ví BTC.
* Ví SOL.
* Sổ MBB.

### Bước 2: App tính số dư dự kiến

App dùng toàn bộ giao dịch đến ngày đối soát.

Ví dụ Binance:

```text
USDT dự kiến: 417,80
BTC dự kiến: 0,00125
SOL dự kiến: 3,50
```

### Bước 3: Người dùng nhập số dư thực tế

Có thể nhập thủ công trước.

Giai đoạn sau mới bổ sung import CSV hoặc ảnh chụp.

### Bước 4: App tính chênh lệch

```text
USDT:
App:       417,80
Thực tế:   415,60
Chênh:      -2,20
```

### Bước 5: Xử lý chênh lệch

Các lựa chọn:

* Tạo giao dịch phí.
* Tạo giao dịch lãi.
* Tạo giao dịch mua hoặc bán còn thiếu.
* Tạo giao dịch điều chỉnh.
* Sửa giao dịch đã có.
* Chấp nhận sai số.
* Để xử lý sau.

### Bước 6: Hoàn thành đối soát

Khi hoàn thành:

* Lưu snapshot.
* Ghi thời điểm.
* Ghi người thực hiện.
* Chạy lại Health Check.
* Đánh dấu tài khoản đã đối soát.
* Không làm thay đổi dữ liệu nếu người dùng chỉ ghi nhận chênh lệch mà chưa xử lý.

## 5.5. Giao dịch điều chỉnh

Không nên sửa trực tiếp số dư hiện tại.

Phải tạo một giao dịch riêng:

```ts
type AdjustmentTransaction = {
  eventId: string;
  accountId: string;
  asset: string;

  amountVnd?: number;
  quantity?: number;

  reason: string;
  reconciliationSessionId: string;
  date: string;
};
```

Ví dụ:

```text
Điều chỉnh Binance:
-2,20 USDT

Lý do:
Phí giao dịch chưa được ghi nhận.
```

Nhờ vậy:

* Có lịch sử.
* Có thể undo.
* Có thể truy nguồn.
* Báo cáo giải thích được thay đổi.

## 5.6. Đối soát cổ phiếu

Không chỉ đối soát tổng giá trị tài sản.

Phải đối soát từng mã:

```text
MBB:
App:     1.150 cổ
VPS:     1.150 cổ
Chênh:       0 cổ

ACB:
App:       500 cổ
VPS:       550 cổ
Chênh:     +50 cổ
```

Nếu có chênh lệch, app gợi ý:

* Thiếu giao dịch mua.
* Thiếu cổ tức cổ phiếu.
* Thiếu cổ phiếu thưởng.
* Sự kiện quyền mua chưa áp dụng.
* Giao dịch đã nhập nhầm mã.

## 5.7. Đối soát sổ MBB

Hiển thị từng sổ:

```text
App: TK-04 — 10.000.000đ
Thực tế: Sổ đuôi 4281 — 10.000.000đ
Kết quả: Khớp
```

Phát hiện:

* Sổ có trong app nhưng không còn trên MB.
* Sổ có trên MB nhưng chưa nhập app.
* Gốc khác nhau.
* Ngày đáo hạn khác.
* Trạng thái khác.
* Bốn số cuối bị trùng.

## 5.8. Trang tổng quan đối soát

```text
MB thanh toán
Lần đối soát cuối: 31/07/2026
Trạng thái: Khớp

Binance
Lần đối soát cuối: 28/07/2026
Trạng thái: Lệch 2,20 USDT

VPS
Chưa đối soát trong tháng này
```

Bộ lọc:

* Đã khớp.
* Có chênh lệch.
* Chưa đối soát.
* Đã quá hạn kiểm tra.

## 5.9. Tiêu chí hoàn thành

* Đối soát được VND, BTC, USDT, SOL và từng mã cổ phiếu.
* Mỗi lần đối soát tạo snapshot riêng.
* Có lịch sử nhiều lần đối soát.
* Giao dịch điều chỉnh không làm mất lịch sử cũ.
* Chênh lệch được đưa vào Health Check.
* Sau khi xử lý, số dư app phải khớp với snapshot thực tế.
* Có thể mở lại một phiên đối soát đã hoàn thành.
* Không tự thay đổi giá vốn khi chỉ điều chỉnh số lượng mà chưa xác định nguyên nhân.

---

# 6. TÍNH NĂNG 7 — SỰ KIỆN CỔ PHIẾU VÀ GIÁ VỐN

App hiện hỗ trợ mua nhiều mã, danh mục, giá vốn trung bình, giá thị trường và rút hoặc chuyển cổ phiếu. Tuy nhiên, lịch sử danh mục hiện chủ yếu dựa trên mua và rút/bán.

## 6.1. Mục tiêu

Xử lý đầy đủ các sự kiện làm thay đổi:

* Số lượng cổ phiếu.
* Giá vốn trung bình.
* Tiền dư CK.
* Thu nhập đầu tư.
* Lãi/lỗ thực nhận.
* Nguồn gốc tài sản.

## 6.2. Các sự kiện giai đoạn đầu

### Cổ tức tiền mặt

Thông tin:

* Mã cổ phiếu.
* Ngày giao dịch không hưởng quyền.
* Ngày đăng ký cuối cùng.
* Ngày thanh toán.
* Số tiền trên mỗi cổ phiếu.
* Thuế.
* Phí.
* Số cổ đủ điều kiện.

Kết quả:

* Không thay đổi số cổ.
* Không thay đổi giá vốn.
* Tăng tiền dư CK hoặc nơi nhận được chọn.
* Ghi nhận thu nhập đầu tư thực nhận.

### Cổ tức cổ phiếu

Thông tin:

* Tỷ lệ nhận.
* Số cổ đủ điều kiện.
* Quy tắc làm tròn.
* Ngày cổ phiếu về tài khoản.

Kết quả:

* Tăng số cổ.
* Tổng giá vốn giữ nguyên.
* Giá vốn trung bình giảm.
* Tạo giao dịch nguồn gốc từ sự kiện cổ tức.

### Cổ phiếu thưởng

Xử lý tương tự cổ tức cổ phiếu nhưng cần phân loại riêng trong báo cáo.

### Chia tách cổ phiếu

Ví dụ:

```text
Tỷ lệ 1:2

Trước:
500 cổ, giá vốn 40.000đ

Sau:
1.000 cổ, giá vốn 20.000đ
```

Tổng giá vốn không đổi.

### Gộp cổ phiếu

Ví dụ:

```text
Tỷ lệ 2:1

Trước:
1.000 cổ

Sau:
500 cổ
```

Cần xử lý cổ phiếu lẻ và phần tiền bù nếu có.

### Quyền mua

Trạng thái:

```text
Được nhận quyền
→ Chưa đăng ký
→ Đã đăng ký
→ Đã thanh toán
→ Cổ phiếu chờ về
→ Đã nhận cổ phiếu
```

Khi thực hiện quyền:

* Trừ tiền dư CK.
* Tăng số cổ khi cổ phiếu về.
* Cộng chi phí mua vào tổng giá vốn.
* Tính lại giá vốn trung bình.

### Đổi mã cổ phiếu

* Chuyển toàn bộ số lượng.
* Chuyển giá vốn.
* Giữ lịch sử mã cũ.
* Liên kết hai mã.

## 6.3. Cấu trúc dữ liệu

```ts
type CorporateAction = {
  id: string;

  symbol: string;
  newSymbol?: string;

  type:
    | "cash_dividend"
    | "stock_dividend"
    | "bonus_issue"
    | "stock_split"
    | "reverse_split"
    | "rights_issue"
    | "symbol_change";

  exDate?: string;
  recordDate?: string;
  paymentDate?: string;
  receiveDate?: string;

  ratioFrom?: number;
  ratioTo?: number;

  cashPerShare?: number;
  subscriptionPrice?: number;

  taxRate?: number;
  fee?: number;

  eligibleShares: number;
  resultingShares?: number;
  cashReceived?: number;

  status:
    | "draft"
    | "announced"
    | "eligible"
    | "pending"
    | "applied"
    | "cancelled";

  linkedEventIds: string[];
  appliedAt?: string;
};
```

## 6.4. Chốt số cổ đủ điều kiện

Không được dùng số cổ hiện tại để tính cổ tức trong quá khứ.

Phải tính:

```text
Số cổ nắm giữ tại ngày chốt quyền
```

Dựa trên:

* Tất cả lệnh mua trước ngày chốt.
* Tất cả lệnh bán hoặc rút trước ngày chốt.
* Các sự kiện cổ phiếu đã áp dụng trước ngày chốt.
* Quy tắc ngày giao dịch và ngày sở hữu mà app đang sử dụng.

Khi tạo sự kiện, app hiển thị:

```text
Số cổ hiện tại: 1.300
Số cổ tại ngày chốt quyền: 1.150
```

Người dùng có thể sửa thủ công nếu dữ liệu thực tế từ công ty chứng khoán khác.

## 6.5. Preview trước khi áp dụng

Ví dụ cổ tức cổ phiếu:

```text
MBB — Cổ tức cổ phiếu 15%

Trước:
- Số lượng: 1.000 cổ
- Giá vốn: 24.000đ
- Tổng vốn: 24.000.000đ

Sau:
- Nhận thêm: 150 cổ
- Tổng số lượng: 1.150 cổ
- Giá vốn mới: 20.869,57đ
- Tổng vốn: 24.000.000đ
```

Người dùng phải bấm “Áp dụng sự kiện”.

## 6.6. Không chỉnh sửa trực tiếp portfolio

Portfolio phải được tính lại từ:

```text
Lệnh mua
- Lệnh bán/rút
+ Sự kiện cổ phiếu
+ Điều chỉnh đối soát đã xác nhận
```

Nếu vẫn giữ field số cổ sửa thủ công, cần đánh dấu:

```text
manualOverride: true
```

Health Check phải cảnh báo khi số cổ override khác số cổ tính từ lịch sử.

## 6.7. Tích hợp với nguồn gốc dòng tiền

Ví dụ cổ tức tiền mặt:

```text
1.000 cổ MBB
→ Cổ tức 500.000đ
→ Thuế 25.000đ
→ Thực nhận 475.000đ
→ Tiền dư CK
```

Ví dụ quyền mua:

```text
Tiền dư CK
→ Thanh toán quyền mua
→ Cổ phiếu chờ về
→ Cổ phiếu MBB
```

## 6.8. Hủy hoặc sửa sự kiện

Nếu sự kiện đã áp dụng:

* Không cho sửa trực tiếp.
* Phải bấm “Hoàn tác sự kiện”.
* App hiển thị dữ liệu bị ảnh hưởng.
* Hoàn tác qua `commitWithUndo`.
* Gỡ các giao dịch phát sinh.
* Tính lại danh mục.
* Chạy Health Check.
* Đồng bộ cloud.

## 6.9. Giao diện đề xuất

Trong tab CK thêm:

### Mục “Sự kiện cổ phiếu”

Các tab:

* Sắp tới.
* Chờ nhận.
* Đã áp dụng.
* Đã hủy.

Trên card từng mã:

* Thêm sự kiện.
* Xem sự kiện.
* Xem lịch sử thay đổi số lượng.
* Xem lịch sử giá vốn.

## 6.10. Tiêu chí hoàn thành

* Cổ tức tiền mặt tạo đúng số tiền thực nhận.
* Cổ tức cổ phiếu làm tăng số lượng nhưng giữ nguyên tổng vốn.
* Quyền mua cộng đúng chi phí vào giá vốn.
* Chia tách giữ nguyên tổng vốn.
* Sự kiện không thể áp dụng hai lần.
* Có thể hoàn tác sự kiện.
* Đối soát cổ phiếu nhận diện được sự kiện còn thiếu.
* Báo cáo phân biệt được lợi nhuận giá và cổ tức.
* Số cổ đủ điều kiện được tính theo ngày chốt quyền.

---

# 7. TÍNH NĂNG 4 — KẾ HOẠCH HÀNH ĐỘNG PHÂN BỔ TIỀN

Tính năng này nên làm cuối cùng vì cần dữ liệu chính xác từ:

* Nguồn gốc dòng tiền.
* Đối soát.
* Danh mục cổ phiếu.
* Sự kiện cổ phiếu.
* Health Check.

## 7.1. Mục tiêu

Khi có một khoản tiền mới, app không chỉ chia theo tỷ lệ cố định mà phải đề xuất:

* Chuyển bao nhiêu vào từng quỹ.
* Mua bao nhiêu USDT.
* Dành bao nhiêu USDT cho DCA.
* Mua mã cổ phiếu nào.
* Tạo sổ MBB nào.
* Ưu tiên mục tiêu nào.
* Hành động nào chưa thể thực hiện.

## 7.2. Dữ liệu đầu vào

### Số tiền có thể phân bổ

* Tiền tiết kiệm tháng.
* Tiền vừa rút từ tài sản.
* Cổ tức.
* Lãi sổ.
* Khoản thu nhập bất thường.
* Số tiền người dùng nhập thủ công.

### Tình trạng hiện tại

* Giá trị từng quỹ.
* Tỷ trọng hiện tại.
* Tỷ trọng mục tiêu.
* Tiền chờ xử lý.
* USDT còn lại.
* Số ngày DCA còn đủ.
* Tiền dư CK.
* Mục tiêu tích lũy sắp đến hạn.
* Quỹ dự phòng hiện có.
* Chi tiêu trung bình.
* Sổ MBB sắp đáo hạn.
* Giá cổ phiếu và quy mô lô mua.

App hiện đã tính vốn, số dư, giá trị hiện tại và lãi/lỗ của Crypto và CK, nên có thể dùng các giá trị đó làm dữ liệu đầu vào cho bộ máy phân bổ.

## 7.3. Cấu hình chiến lược

```ts
type AllocationStrategy = {
  id: string;
  name: string;

  targetWeights: {
    crypto: number;
    stock: number;
    saving: number;
    emergency: number;
  };

  emergencyFundMonths: number;
  minimumDcaCoverageDays: number;

  minimumAmounts: {
    crypto?: number;
    stock?: number;
    saving?: number;
    emergency?: number;
  };

  maximumMonthlyAllocation?: {
    crypto?: number;
    stock?: number;
  };

  fallbackFund:
    | "crypto"
    | "stock"
    | "saving"
    | "emergency"
    | "keep_cash";
};
```

Có thể tạo ba preset:

* An toàn.
* Cân bằng.
* Tăng trưởng.

Nhưng người dùng phải có thể chỉnh toàn bộ thông số.

## 7.4. Quy tắc ưu tiên

### Ưu tiên 1: Khắc phục lỗi

Không tạo kế hoạch nếu:

* Có lỗi Critical.
* Số dư quỹ âm.
* Đối soát có chênh lệch lớn chưa xử lý.
* Giá tài sản quá cũ.
* Dữ liệu danh mục CK không khớp lịch sử.

App hiển thị:

```text
Chưa thể lập kế hoạch chính xác.

Cần xử lý:
- Binance lệch 12 USDT.
- Số cổ MBB trong app thiếu 100 cổ.
```

### Ưu tiên 2: Quỹ dự phòng tối thiểu

```text
Mục tiêu dự phòng
= Chi tiêu trung bình × số tháng mục tiêu
```

Nếu quỹ dự phòng thiếu, app ưu tiên bổ sung theo mức cấu hình.

### Ưu tiên 3: Các nghĩa vụ đến hạn

* Mục tiêu tích lũy gần ngày cần dùng.
* Khoản cố định chưa đủ.
* Sổ cần tái tục.
* DCA sắp hết tiền.

### Ưu tiên 4: Cân bằng tỷ trọng

Tính giá trị danh mục sau khi thêm khoản tiền mới:

```text
Tổng tài sản dự kiến
= Tổng tài sản hiện tại + Tiền mới
```

Sau đó tính giá trị mục tiêu của từng quỹ:

```text
Giá trị mục tiêu quỹ
= Tổng tài sản dự kiến × Tỷ trọng mục tiêu
```

Thiếu hụt:

```text
Thiếu hụt
= max(0, Giá trị mục tiêu - Giá trị hiện tại)
```

Phân bổ phần tiền còn lại theo tỷ lệ thiếu hụt.

### Ưu tiên 5: Làm tròn theo điều kiện thực tế

* Cổ phiếu phải đủ số cổ tối thiểu app đang áp dụng.
* Sổ MBB phải đạt số tiền tối thiểu.
* DCA phải đủ ít nhất một kỳ.
* CCTG có thể cần làm tròn theo mệnh giá.
* Tiền lẻ chuyển vào quỹ fallback.

## 7.5. Kế hoạch và hành động

```ts
type AllocationPlan = {
  id: string;
  sourceEventId?: string;
  availableAmount: number;

  strategyId: string;

  status:
    | "draft"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "cancelled";

  currentSnapshot: AllocationSnapshot;
  projectedSnapshot: AllocationSnapshot;

  items: AllocationPlanItem[];

  createdAt: string;
};
```

```ts
type AllocationPlanItem = {
  id: string;

  actionType:
    | "transfer_fund"
    | "buy_usdt"
    | "buy_stock"
    | "create_mbb_book"
    | "fund_saving_goal"
    | "keep_cash";

  amountVnd: number;

  stockSymbol?: string;
  estimatedQuantity?: number;

  targetFund?: string;
  targetAccountId?: string;

  reason: string;
  priority: number;

  status:
    | "pending"
    | "ready"
    | "completed"
    | "skipped"
    | "blocked";

  executedEventIds: string[];
};
```

## 7.6. Ví dụ kết quả

```text
Số tiền cần phân bổ: 6.500.000đ

1. Quỹ dự phòng — 2.000.000đ
Lý do:
Quỹ dự phòng hiện mới đạt 4,2/6 tháng.

2. Quỹ CK — 3.000.000đ
Lý do:
Tỷ trọng CK hiện thấp hơn mục tiêu 7,8%.

Đề xuất:
- Mua 100 cổ MBB.
- Phần tiền còn lại giữ trong tiền dư CK.

3. Crypto — 1.500.000đ
Lý do:
USDT chỉ còn đủ cho 6 kỳ DCA.

Đề xuất:
- Mua khoảng 58 USDT.
```

## 7.7. Không tự thực hiện giao dịch

Bộ máy chỉ tạo kế hoạch.

Người dùng bấm từng hành động:

```text
Mua 58 USDT
```

App mở form Mua USDT đã điền sẵn:

* Số VND.
* Ngày.
* Note.
* ID kế hoạch.

Sau khi lưu:

* Gắn giao dịch với `planItemId`.
* Đánh dấu hành động hoàn thành.
* Tính lại kế hoạch.
* Cập nhật tỷ trọng dự kiến.

## 7.8. Mô phỏng trước và sau

Hiển thị:

```text
Trước kế hoạch:

Crypto:    28%
CK:        21%
Tiết kiệm: 34%
Dự phòng:  17%

Sau kế hoạch:

Crypto:    26%
CK:        25%
Tiết kiệm: 31%
Dự phòng:  18%
```

Ngoài tỷ trọng, cần hiển thị:

* Số tháng dự phòng.
* Số ngày DCA còn đủ.
* Tiến độ mục tiêu tích lũy.
* Tiền còn chưa phân bổ.
* Hành động bị chặn.

## 7.9. Chế độ mô phỏng

Cho phép người dùng thay đổi:

* Số tiền mới.
* Tỷ lệ mục tiêu.
* Giá BTC.
* Giá cổ phiếu.
* Số tháng dự phòng.
* Mức DCA.

Mô phỏng không được ghi vào state thật cho đến khi người dùng bấm “Lưu kế hoạch”.

## 7.10. Giải thích đề xuất

Mỗi đề xuất phải có lý do cụ thể.

Không hiển thị:

```text
Nên đầu tư thêm vào CK.
```

Phải hiển thị:

```text
Nên phân bổ 3.000.000đ vào CK vì:

- CK đang thấp hơn tỷ trọng mục tiêu 7,8%.
- Quỹ dự phòng đã đạt mức tối thiểu.
- Mục tiêu tích lũy tháng này đã đủ.
- USDT vẫn đủ cho 30 ngày DCA.
```

## 7.11. Tiêu chí hoàn thành

* Không lập kế hoạch khi có lỗi Critical.
* Kế hoạch có snapshot trước và sau.
* Tổng tiền phân bổ không vượt số tiền khả dụng.
* Tiền lẻ được xử lý theo cấu hình.
* Mỗi hành động mở đúng form tương ứng.
* Giao dịch đã thực hiện được liên kết với kế hoạch.
* Có thể bỏ qua hoặc thay đổi từng hành động.
* Kế hoạch tự tính lại khi giá tài sản hoặc số dư thay đổi.
* Không tự động mua, bán hoặc chuyển tiền.
* Mọi đề xuất đều có lý do giải thích.

---

# 8. TÍCH HỢP GIỮA 5 TÍNH NĂNG

## 8.1. Nguồn gốc dòng tiền và đối soát

Nếu đối soát phát hiện thiếu 2 USDT:

```text
Đối soát
→ Tạo giao dịch phí
→ Liên kết phí với giao dịch mua BTC
→ Cập nhật nguồn gốc dòng tiền
```

## 8.2. Đối soát và Health Check

```text
Binance lệch 2 USDT
→ Health Check tạo Warning
→ Người dùng ghi nhận phí
→ Chạy lại kiểm tra
→ Warning được giải quyết
```

## 8.3. Sự kiện cổ phiếu và đối soát

```text
VPS có thêm 150 cổ MBB
→ App phát hiện chênh lệch
→ Gợi ý thiếu sự kiện cổ tức cổ phiếu
→ Người dùng tạo sự kiện
→ Số cổ và giá vốn được cập nhật
→ Đối soát trở về trạng thái khớp
```

## 8.4. Sự kiện cổ phiếu và nguồn tiền

```text
Cổ tức tiền mặt
→ Tiền dư CK
→ Kế hoạch phân bổ
→ Mua cổ phiếu hoặc chuyển quỹ
```

## 8.5. Health Check và kế hoạch phân bổ

Kế hoạch phân bổ chỉ được tạo khi:

* Không có lỗi Critical.
* Số dư hợp lệ.
* Danh mục CK khớp.
* Giá tài sản đủ mới.
* Đối soát không có chênh lệch nghiêm trọng.

---

# 9. BACKLOG TRIỂN KHAI THEO SPRINT

## Sprint 1 — Chuẩn hóa dữ liệu

* Tạo `TransactionMeta`.
* Bổ sung `eventId`.
* Bổ sung `groupId`.
* Tạo danh sách tài khoản tối thiểu.
* Tạo migration.
* Tạo `buildFinancialIndex`.
* Kiểm tra backup và restore.
* Đảm bảo cloud sync lưu metadata mới.

## Sprint 2 — Nguồn gốc dòng tiền cơ bản

* Liên kết chia quỹ.
* Liên kết chuyển Crypto.
* Liên kết chuyển CK.
* Liên kết tiền chờ tạo sổ.
* Liên kết sổ cha–con.
* Màn hình nguồn vào.
* Màn hình dữ liệu liên quan.
* Preview tác động khi xóa.

## Sprint 3 — Health Check phiên bản đầu

* Rule số dư âm.
* Rule vượt số dư.
* Rule thiếu đối ứng.
* Rule ID liên kết không tồn tại.
* Rule chia quỹ sai.
* Rule sổ MBB sai trạng thái.
* Trung tâm hiển thị lỗi.
* Đi đến dữ liệu liên quan.
* Auto-fix an toàn.
* Undo auto-fix.

## Sprint 4 — Trung tâm đối soát

* Danh sách tài khoản.
* Tạo phiên đối soát.
* Nhập số dư thực tế.
* Tính chênh lệch.
* Xử lý phí và điều chỉnh.
* Đối soát Crypto.
* Đối soát CK theo mã.
* Đối soát sổ MBB.
* Lịch sử đối soát.
* Kết nối Health Check.

## Sprint 5 — Sự kiện cổ phiếu

* Cổ tức tiền mặt.
* Cổ tức cổ phiếu.
* Cổ phiếu thưởng.
* Chia tách và gộp cổ phiếu.
* Quyền mua.
* Đổi mã.
* Preview tác động.
* Áp dụng và hoàn tác.
* Tính lại portfolio.
* Liên kết với đối soát và nguồn tiền.

## Sprint 6 — Health Check nâng cao

* Giao dịch trùng.
* Tài sản không có nguồn.
* Danh mục CK không khớp lịch sử.
* Sự kiện cổ phiếu áp dụng trùng.
* Cổ tức tính sai số cổ.
* Cloud ledger không khớp.
* Giá thị trường quá cũ.
* Báo cáo lỗi sau migration.

## Sprint 7 — Bộ máy phân bổ

* Cấu hình chiến lược.
* Tỷ trọng mục tiêu.
* Quy tắc quỹ dự phòng.
* Quy tắc DCA.
* Quy tắc mục tiêu tích lũy.
* Tính thiếu hụt từng quỹ.
* Làm tròn theo tài sản.
* Tạo kế hoạch.
* Preview trước và sau.
* Giải thích đề xuất.

## Sprint 8 — Thực thi kế hoạch

* Mở form đã điền sẵn.
* Liên kết giao dịch với plan item.
* Theo dõi trạng thái.
* Bỏ qua hành động.
* Thay đổi hành động.
* Tính lại kế hoạch.
* Hoàn thành kế hoạch.
* Lưu lịch sử kế hoạch.

---

# 10. KIỂM THỬ BẮT BUỘC

## Kiểm thử migration

* Dữ liệu cũ không mất.
* Tổng tài sản trước và sau migration bằng nhau.
* Tất cả giao dịch có `eventId`.
* Không tạo trùng ID.
* Backup cũ vẫn restore được.
* Cloud sync không ghi đè sai dữ liệu.

## Kiểm thử nguồn tiền

* Một giao dịch có nhiều nguồn.
* Một nguồn được sử dụng cho nhiều giao dịch.
* Xóa giao dịch cha.
* Xóa giao dịch con.
* Hoàn tác giao dịch.
* Restore giao dịch từ thùng rác.
* Liên kết vẫn tồn tại sau reload.

## Kiểm thử đối soát

* Số dư khớp.
* Chênh lệch âm.
* Chênh lệch dương.
* Giao dịch điều chỉnh.
* Phí Crypto.
* Thiếu cổ phiếu.
* Thiếu sổ MBB.
* Mở lại phiên đối soát.

## Kiểm thử cổ phiếu

* Cổ tức tiền mặt.
* Cổ tức cổ phiếu.
* Cổ phiếu lẻ.
* Quyền mua một phần.
* Hủy quyền mua.
* Chia tách.
* Gộp cổ phiếu.
* Áp dụng sự kiện hai lần.
* Hoàn tác sự kiện.

## Kiểm thử Health Check

* Lỗi xuất hiện đúng severity.
* Lỗi biến mất sau khi sửa.
* Lỗi bỏ qua không xuất hiện lại nếu dữ liệu không đổi.
* Lỗi xuất hiện lại khi dữ liệu thay đổi.
* Auto-fix có audit log.
* Auto-fix có undo.

## Kiểm thử kế hoạch phân bổ

* Không đủ tiền.
* Tiền bằng 0.
* Quỹ dự phòng thiếu nhiều.
* USDT hết.
* CK vượt tỷ trọng.
* Giá cổ phiếu không có.
* Không đủ mua số cổ tối thiểu.
* Tiền lẻ sau phân bổ.
* Có lỗi Critical.
* Giá thị trường quá cũ.

---

# 11. TIÊU CHUẨN HOÀN THÀNH TOÀN BỘ

Hệ thống được xem là hoàn thành khi:

1. Mọi giao dịch quan trọng đều có định danh và quan hệ nguồn–đích.
2. Có thể xem nguồn hình thành của BTC, SOL, USDT, cổ phiếu và sổ MBB.
3. Có thể đối soát số dư thực tế và lưu lịch sử từng lần đối soát.
4. Sự kiện cổ phiếu làm thay đổi đúng số lượng và giá vốn.
5. Bộ kiểm tra phát hiện được dữ liệu âm, thiếu đối ứng, trùng và mất liên kết.
6. Mọi sửa chữa tự động đều có preview, audit log và undo.
7. Kế hoạch phân bổ không sử dụng dữ liệu đang có lỗi nghiêm trọng.
8. Mỗi đề xuất phân bổ đều giải thích được nguyên nhân.
9. Giao dịch thực hiện từ kế hoạch được liên kết lại với kế hoạch.
10. Tổng tài sản không thay đổi sai sau migration, restore hoặc cloud sync.

# 12. THỨ TỰ ƯU TIÊN CUỐI CÙNG

Thứ tự nên thực hiện:

```text
1. Chuẩn hóa ID và quan hệ giao dịch
2. Theo dõi nguồn gốc dòng tiền
3. Health Check cơ bản
4. Trung tâm đối soát
5. Sự kiện cổ phiếu
6. Health Check nâng cao
7. Kế hoạch phân bổ
8. Tích hợp và kiểm thử toàn hệ thống
```

Không nên làm tính năng phân bổ trước, vì nếu số dư, giá vốn hoặc danh mục đang sai thì kế hoạch được tạo ra cũng sẽ sai.

Cũng không nên triển khai sự kiện cổ phiếu chỉ bằng cách cộng trực tiếp số cổ vào portfolio. Mọi thay đổi cần được ghi thành một sự kiện riêng để có thể truy nguồn, đối soát và hoàn tác.
