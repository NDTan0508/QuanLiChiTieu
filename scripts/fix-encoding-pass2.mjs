import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const filePath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "App.tsx");
let content = readFileSync(filePath, "utf8");

const replacements = [
  // URLs
  ["bgapidatafee?.vps.com.vn", "bgapidatafee.vps.com.vn"],
  ["stock_pricesĐsort", "stock_prices?sort"],

  // Remaining Đ-corruption (longer first)
  ["ĐĐĐc kiện", "dự kiến"],
  ["ĐĐĐc liệu", "dữ liệu"],
  ["ĐĐ liệu", "Dữ liệu"],
  ["ĐĐĐc", "được"],
  ["Giá trĐ", "Giá trị"],
  ["nhĐn", "nhận"],
  ["Mởc tích luy", "Mục tích luyy"],
  ["Mởc tiêu", "Mục tiêu"],
  ["Ngày gĐi", "Ngày gửi"],
  ["cuối kĐ", "cuối kỳ"],
  ["CCTG dã", "CCTG đã"],
  ["Mã sĐ", "Mã số"],
  ["TĐt toán", "Tất toán"],
  ["TiĐn chia", "Tiền chia"],
  ["TiĐn SOL", "Tiền SOL"],
  ["TiĐn CK", "Tiền CK"],
  ["TiĐn BTC", "Tiền BTC"],
  ["chuyển vĐ", "chuyển về"],
  ["chưa tạo sĐ", "chưa tạo sổ"],
  ["Tạo sĐ", "Tạo sổ"],
  ["Xem sĐ", "Xem sổ"],
  ["sĐp đáo", "sắp đáo"],
  ["dã đáo", "đã đáo"],
  ["dã tick", "đã tick"],
  ["dã xác", "đã xác"],
  ["dã chuy", "đã chuy"],
  ["tĐng tiền", "tổng tiền"],
  ["cĐn dùng", "cần dùng"],
  ["hoĐc số", "hoặc số"],
  ["giĐ trong", "giữ trong"],
  ["Hoàn tĐt", "Hoàn tất"],
  ["name}Đ", "name}?"],
  ["mua ĐĐĐc", "mua đồ"],
  ["Sửa xe, mua ĐĐĐc", "Sửa xe, mua đồ"],

  // ?-mojibake (longer first)
  ["App s? ghi giao d?ch vào BTC/CK. Qu? ti?t ki?m và ?? phòng s? ???c dánh ??u ch? t?o s? ? trang riêng.", "App sẽ ghi giao dịch vào BTC/CK. Quỹ tiết kiệm và dự phòng sẽ được đánh dấu chỉ tạo sổ ở trang riêng."],
  ["S? l? sau khi làm tròn b?i s? {formatVnd(CERTIFICATE_LOT)} ???c c?ng vào BTC.", "Số lẻ sau khi làm tròn bởi số {formatVnd(CERTIFICATE_LOT)} được cộng vào BTC."],
  ["Ch?a có ?? li?u trong tháng này.", "Chưa có dữ liệu trong tháng này."],
  ["Ch?a có ?? li?u nào trong thùng rác.", "Chưa có dữ liệu nào trong thùng rác."],
  ["Ch?a có m?c tích luy ?ang ho?t ??ng.", "Chưa có mục tích luy đang hoạt động."],
  ["Ch?a có c? phi?u nào.", "Chưa có cổ phiếu nào."],
  ["Ch?a có c? phi?u ???c rút.", "Chưa có cổ phiếu được rút."],
  ["Ch?a có giao d?ch DCA nào.", "Chưa có giao dịch DCA nào."],
  ["Ch?a có log thao tác.", "Chưa có log thao tác."],
  ["Ch?a có m?c tích luy nào.", "Chưa có mục tích luy nào."],
  ["K? ho?ch chi c? ??nh", "Kế hoạch chi cố định"],
  ["Thu nh?p, chi tiêu, chia qu?", "Thu nhập, chi tiêu, chia quỹ"],
  ["Qu?n lý tháng", "Quản lý tháng"],
  ["Thêm thu nh?p", "Thêm thu nhập"],
  ["Thêm m?c m?i", "Thêm mục mới"],
  ["L?u di?u ch?nh", "Lưu điều chỉnh"],
  ["Xác nh?n chia qu?", "Xác nhận chia quỹ"],
  ["Đ?ng ý chia qu?", "Đồng ý chia quỹ"],
  ["Qu? ti?t ki?m", "Quỹ tiết kiệm"],
  ["?? phòng", "dự phòng"],
  ["Hàng tu?n", "Hàng tuần"],
  ["Ti?t ki?m", "Tiết kiệm"],
  ["C? ??nh", "Cố định"],
  ["M?t l?n", "Một lần"],
  ["Kho?n phát sinh", "Khoản phát sinh"],
  ["Thêm kho?n chi", "Thêm khoản chi"],
  ["Kho?n c? ??nh ch? tính khi tick dã chuy?n", "Khoản cố định chỉ tính khi tick đã chuyển"],
  ["L?ch s? thu nh?p", "Lịch sử thu nhập"],
  ["L?ch s? phát sinh", "Lịch sử phát sinh"],
  ["Chia qu? cu?i tháng", "Chia quỹ cuối tháng"],
  ["T?ng t? l?", "Tổng tỷ lệ"],
  ["T?ng ti?n", "Tổng tiền"],
  ["Chia l?i theo t? l?", "Chia lại theo tỷ lệ"],
  ["t? l? ph?n tr?m", "tỷ lệ phần trăm"],
  ["s? ti?n", "số tiền"],
  ["Tháng này dã xác nh?n chia qu.", "Tháng này đã xác nhận chia quỹ."],
  ["Có th? chia quỹ", "Có thể chia quỹ"],
  ["Hôm nay c?n làm gì", "Hôm nay cần làm gì"],
  ["vi?c c?n x? lý", "việc cần xử lý"],
  ["{tasks.length} vi?c", "{tasks.length} việc"],
  ["{totalRows} giao d?ch", "{totalRows} giao dịch"],
  ["Chi ti?t", "Chi tiết"],
  ["xem chi ti?t", "xem chi tiết"],
  ["B?m vào", "Bấm vào"],
  ["???c xem", "được xem"],
  ["t?ng kho?n", "tổng khoản"],
  ["Thêm m?c", "Thêm mục"],
  ["Xóa m?c", "Xóa mục"],
  ["Tên m?c", "Tên mục"],
  ["M?c tiêu tích luy", "Mục tiêu tích luy"],
  ["M?c tích luy", "Mục tích luy"],
  ["T?ng ti?n c?n ??n", "Tổng tiền cần đến"],
  ["Tháng b?t ??u", "Tháng bắt đầu"],
  ["Ngày c?n dùng", "Ngày cần dùng"],
  ["Ti?n m?i tháng", "Tiền mới tháng"],
  ["Còn c?n ??n", "Còn cần đến"],
  ["kho?ng {formatVnd", "khoảng {formatVnd"],
  ["Ti?n ???c", "Tiền đạt"],
  ["C?n thêm", "Cần thêm"],
  ["K?t thúc", "Kết thúc"],
  ["S? ti?n", "Số tiền"],
  ["Gi? ch?y", "Giờ chạy"],
  ["Giá th? tr??ng", "Giá thị trường"],
  ["Danh m?c c? phi?u", "Danh mục cổ phiếu"],
  ["Danh m?c tài s?n", "Danh mục tài sản"],
  ["Tài s?n", "Tài sản"],
  ["T?ng tài s?n", "Tổng tài sản"],
  ["Lãi/l? theo g?c", "Lãi/lỗ theo gốc"],
  ["Phân b? qu? tài chính", "Phân bổ quỹ tài chính"],
  ["Thêm s? MBB", "Thêm sổ MBB"],
  ["Lo?i s?", "Loại sổ"],
  ["Quay l?i", "Quay lại"],
  ["S? ki?n c? phi?u", "Sự kiện cổ phiếu"],
  ["Rút c? phi?u", "Rút cổ phiếu"],
  ["S? c? ", "Số cổ "],
  ["Nh?p DCA cu", "Nhập DCA cũ"],
  ["Tháng chia qu?", "Tháng chia quỹ"],
  ["L?u phiên ??i soát", "Lưu phiên đối soát"],
  ["L?u BTC", "Lưu BTC"],
  ["L?u USDT", "Lưu USDT"],
  ["L?u k? ho?ch", "Lưu kế hoạch"],
  ["M? form DCA", "Mở form DCA"],
  ["L?nh DCA ?ang ch?y", "Lệnh DCA đang chạy"],
  ["{state.btcDcaPlans.length} k? ho?ch", "{state.btcDcaPlans.length} kế hoạch"],
  ["{activeDcaPlans.length} k? ho?ch", "{activeDcaPlans.length} kế hoạch"],
  ["L?ch s? BTC", "Lịch sử BTC"],
  ["L?ch s?", "Lịch sử"],
  ["{historyRows.length} giao d?ch Crypto", "{historyRows.length} giao dịch Crypto"],
  ["Rút / chuy?n", "Rút / chuyển"],
  ["Rút ti?n", "Rút tiền"],
  ["Ti?n m?t", "Tiền mặt"],
  ["T?o backup JSON", "Tạo backup JSON"],
  ["T?m ??ng", "Tạm dừng"],
  ["Đang ch?y", "Đang chạy"],
  ["Ngày g?i", "Ngày gửi"],
  ["Ti?n nh?n", "Tiền nhận"],
  ["S? ti?n mua", "Số tiền mua"],
  ["S? du CK", "Số dư CK"],
  ["Qu? {label}", "Quỹ {label}"],
  ["Đã t?o s? m?i t? s? này.", "Đã tạo sổ mới từ sổ này."],
  ["USDT ch? còn ?? DCA được 5 ngày", "USDT chỉ còn đủ DCA được 5 ngày"],
  ["Nhập tên, tổng tiền và ngày cần dùng hoặc số tháng/số tiền mới tháng.", "Nhập tên, tổng tiền và ngày cần dùng hoặc số tháng/số tiền mỗi tháng."],
  ["Xóa mục ${goal.name}Đ Các tháng dã tick vốn được giĐ trong báo cáo cũ.", "Xóa mục ${goal.name}? Các tháng đã tick vốn được giữ trong báo cáo cũ."],
  ["K?t thúc mục ${goal.name}Đ Checklist từ tháng sau số không còn hiển thị mục này.", "Kết thúc mục ${goal.name}? Checklist từ tháng sau sẽ không còn hiển thị mục này."],
];

// Fix typo introduced above
replacements.push(["Mục tích luyy", "Mục tích luy"]);

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

writeFileSync(filePath, content, "utf8");

// Report remaining suspicious string fragments in quotes only
const remaining = new Set();
for (const match of content.matchAll(/"((?:\\.|[^"\\])*)"/g)) {
  const value = match[1];
  if (/[ĐÐ]/.test(value) || /\?[a-zA-Zà-ỹÀ-Ỹ]|[a-zA-Zà-ỹÀ-Ỹ]\?|\?\?/.test(value)) {
    if (!value.includes("?.") && !value.includes("??") && !value.includes("?ids=") && !value.includes("?symbol=") && !value.includes("?sort=")) {
      remaining.add(value.length > 80 ? value.slice(0, 80) + "..." : value);
    }
  }
}

console.log(`Fixed encoding pass 2. Remaining suspicious literals: ${remaining.size}`);
for (const value of [...remaining].sort().slice(0, 40)) {
  console.log("-", JSON.stringify(value));
}
