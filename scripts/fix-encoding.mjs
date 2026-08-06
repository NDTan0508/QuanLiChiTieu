import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const filePath = join(root, "src", "App.tsx");
let content = readFileSync(filePath, "utf8");

const replacements = [
  ["priceĐids", "price?ids"],
  ["priceĐsymbol", "price?symbol"],
  ["Không lĐy ĐĐĐc", "Không lấy được"],
  ["giao ĐĐĐcch", "giao dịch"],
  ["ĐĐ phòng", "Dự phòng"],
  ["hiĐn thĐ", "hiển thị"],
  ["Hàng tuĐn", "Hàng tuần"],
  ["Ðang chĐy", "Đang chạy"],
  ["Ðang chĐ", "Đang chờ"],
  ["Rút tĐ CK", "Rút từ CK"],
  ["khôi phĐc", "khôi phục"],
  ["danh mĐc", "danh mục"],
  ["Xác nhĐn", "Xác nhận"],
  ["Yêu cĐu tĐo sĐ tiĐt kiĐm", "Yêu cầu tự do số tiết kiệm"],
  ["Ðã tĐo sĐ tiĐt kiĐm", "Đã tự do số tiết kiệm"],
  ["Yêu cĐu tĐo sẽ được phòng", "Yêu cầu tự do sẽ dự phòng"],
  ["Ðã tĐo sẽ được phòng", "Đã tự do sẽ dự phòng"],
  ["% ?? phòng", "% Dự phòng"],
  ["Rút vĐn", "Rút vốn"],
  ["ChĐ tiêu", "Chỉ tiêu"],
  ["Giá trĐ", "Giá trị"],
  ["TĐng tài sĐn", "Tổng tài sản"],
  ["TĐng", "Tổng"],
  ["quĐ", "quỹ"],
  ["cuĐi tháng", "cuối tháng"],
  ["cuĐi", "cuối"],
  ["tiĐn mĐt", "tiền mặt"],
  ["Cổ tức tiĐn mĐt", "Cổ tức tiền mặt"],
  ["TrĐng thái", "Trạng thái"],
  ["bĐt ĐĐu", "bắt đầu"],
  ["Ðã ĐĐu tĐ", "Đã đầu tư"],
  ["hiĐn tĐi", "hiện tại"],
  ["Lãi/lĐ", "Lãi/lỗ"],
  ["gĐn nhĐt", "gần nhất"],
  ["Mởc tiêu", "Mục tiêu"],
  ["Ðã ĐĐĐcn", "Đã đạt"],
  ["dã ĐĐĐcn", "đã đạt"],
  ["Còn lĐi", "Còn lại"],
  ["SĐ tháng", "Số tháng"],
  ["Ngày tĐo", "Ngày tạo"],
  ["Ngày nhĐn", "Ngày nhận"],
  ["quyĐn", "quyền"],
  ["Ðã áp ĐĐng", "Đã áp dụng"],
  ["dáo hĐn", "đáo hạn"],
  ["cĐp nhĐt", "cập nhật"],
  ["chi cĐ ĐĐnh", "chi cố định"],
  ["lĐu diĐu chọnh", "lưu điều chỉnh"],
  ["mĐc chi", "mục chi"],
  ["chia qu.", "chia quỹ."],
  ["nàyĐ", "này?"],
  ["Ð?ng ý chia qu?", "Đồng ý chia quỹ"],
  ["sĐa mĐc", "sửa mục"],
  ["tĐo mĐc", "tạo mục"],
  ["kĐt thúc", "kết thúc"],
  ["Ði?u ch?nh", "Điều chỉnh"],
  ["sĐa kĐ hoĐch", "sửa kế hoạch"],
  ["tĐo kĐ hoĐch", "tạo kế hoạch"],
  ["tĐm ĐĐng", "tạm dừng"],
  ["bĐt lĐi", "bật lại"],
  ["chọnh sĐ", "chọn số"],
  ["lĐu rút", "lưu rút"],
  ["Sự kiện cu", "Sự kiện cổ"],
  ["ĐĐi soát", "đối soát"],
  ["??i soát", "đối soát"],
  ["L?u phiên", "Lưu phiên"],
  ["ThiĐu", "Thiếu"],
  ["ÐiĐu chọnh", "Điều chỉnh"],
  ["xĐ lý", "xử lý"],
  ["ChĐp nhĐn lĐch", "Chấp nhận lệch"],
  ["mĐ lĐi", "mở lại"],
  ["lĐu lĐi", "lưu lại"],
  ["Chọn mĐc", "Chọn mục"],
  ["sĐ này", "sổ này"],
  ["clou?.", "cloud."],
  ["phĐi JSON", "phải JSON"],
  ["nguĐn", "nguồn"],
  ["Tài sĐn", "Tài sản"],
  ["trĐc tiĐp", "trước tiếp"],
  ["nĐu", "nếu"],
  ["VĐn", "Vốn"],
  ["vĐn", "vốn"],
  ["liĐu", "liệu"],
  ["Hành ĐĐng", "Hành động"],
  ["TrĐĐc", "Trước"],
  ["ĐĐc liĐu", "dữ liệu"],
  ["gĐc", "gốc"],
  ["HĐt hĐn", "Hết hạn"],
  ["kiĐn", "kiện"],
  ["tĐt toán", "tất toán"],
  ["SĐ cha", "Số cha"],
  ["SĐ con", "Số con"],
  ["TĐ tháng", "Từ tháng"],
  ["lĐch", "lệch"],
  ["sĐp dáo", "sắp đáo"],
  ["TiĐn tĐ", "Tiền từ"],
  ["chưa mua cĐ", "chưa mua cổ"],
  ["chia quĐ", "chia quỹ"],
  ["chĐ còn", "chỉ còn"],
  ["ĐĐĐcĐi", "được"],
  ["khoĐng", "khoảng"],
  ["vĐi", "với"],
  ["Quỹ tiĐt kiĐm", "Quỹ tiết kiệm"],
  ["Quỹ ĐĐĐc phòng", "Quỹ dự phòng"],
  ["S? s?p dáo h?n", "Sắp đáo hạn"],
  ["Ch?a có s? nào c?n x? lý trong 3 ngày t?i.", "Chưa có sổ nào cần xử lý trong 3 ngày tới."],
  ["Hôm nay c?n làm gì", "Hôm nay cần làm gì"],
  ["Không có vi?c c?n x? lý ngay.", "Không có việc cần xử lý ngay."],
  ["giao d?ch ti?p theo", "giao dịch tiếp theo"],
  ["qu? CK", "quỹ CK"],
  ["Ðóng", "Đóng"],
  ["tiĐn", "tiền"],
  ["mĐt", "mặt"],
  ["lĐy", "lấy"],
  ["lĐu", "lưu"],
  ["tĐo", "tạo"],
  ["sĐa", "sửa"],
  ["mĐc", "mục"],
  ["phĐc", "phục"],
  ["tĐ ", "từ "],
  ["cĐ ", "cổ "],
  ["cĐ.", "cổ."],
  ["chĐ", "chờ"],
  ["sĐ ", "số "],
  ["sĐ.", "số."],
  ["n?a", "nữa"],
  ["Ð", "Đ"],
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

// Remove duplicate consecutive lines where a corrupted line was kept alongside the fix.
const lines = content.split("\n");
const deduped = [];
for (let index = 0; index < lines.length; index += 1) {
  const current = lines[index];
  const next = lines[index + 1];
  if (next && current.trim() && next.trim()) {
    const currentTrim = current.trim();
    const nextTrim = next.trim();
    const currentNorm = currentTrim.replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
    const nextNorm = nextTrim.replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
    if (
      currentNorm === nextNorm &&
      currentTrim !== nextTrim &&
      /Đ|Ð|\?/.test(currentTrim) &&
      !/ĐĐ|lĐ|tĐ|mĐ|sĐ|cĐ|vĐ|nĐ|gĐ|HĐ|kĐ|bĐ|quĐ|phĐ|hiĐ|tuĐ|chĐ|TrĐ|BĐ|nhĐ|kiĐ|lĐi|dáo h/.test(nextTrim)
    ) {
      continue;
    }
  }
  deduped.push(current);
}
content = deduped.join("\n");

writeFileSync(filePath, content, "utf8");
console.log("Fixed encoding in App.tsx");
