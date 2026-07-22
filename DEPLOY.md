# Đưa App Online

App chạy online như PWA và đồng bộ dữ liệu giữa laptop/iPhone bằng Supabase.

## 1. Tạo Supabase

1. Vào `https://supabase.com` và tạo project mới.
2. Mở `SQL Editor`.
3. Copy toàn bộ nội dung file `supabase-schema.sql`.
4. Chạy SQL để tạo bảng `app_snapshots`.
5. Vào `Project Settings` > `API`.
6. Lấy `Project URL` và `anon public key`.

Lưu ý: dữ liệu được mã hóa trong trình duyệt bằng mã PIN tài khoản. Không dùng PIN quá ngắn hoặc dễ đoán.

## 2. Chạy local với cloud sync

Tạo file `.env.local` từ `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Sau đó chạy:

```bash
npm run dev
```

Mở `/admin` trước để tạo tài khoản PIN đầu tiên. Sau đó quay lại `/` và đăng nhập bằng PIN đó.

## 3. Deploy Vercel

1. Đưa project lên GitHub.
2. Vào Vercel, tạo project mới từ repo.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Thêm Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy.

## 4. Dùng trên iPhone

1. Mở link Vercel bằng Safari.
2. Bấm Share.
3. Chọn `Add to Home Screen`.
4. Mở app từ icon ngoài màn hình chính.
5. Nếu chưa có tài khoản, mở `/admin` trên link app để tạo PIN.
6. Quay lại `/` và nhập cùng mã PIN tài khoản đã dùng trên laptop.

## 5. Quy tắc đồng bộ

- Mã PIN chính là khóa tài khoản và khóa mã hóa dữ liệu.
- Tài khoản mới được tạo tại `/admin`.
- Đổi PIN tài khoản tại `/admin`, hoặc trong `Cài đặt` sau khi đã đăng nhập.
- App tải dữ liệu cloud sau khi nhập PIN.
- App tự lưu lên cloud sau khi dữ liệu thay đổi.
- Khi hai thiết bị cùng sửa gần như đồng thời, bản lưu sau cùng sẽ thắng.
- Nếu nhập PIN khác đã được tạo ở `/admin`, app sẽ mở bộ dữ liệu của PIN đó.
- Nếu PIN chưa được tạo, app sẽ yêu cầu vào `/admin`.

## 6. Reset dữ liệu

Bản hiện tại đã đổi namespace dữ liệu local và cloud. Khi cập nhật lên bản này, app bắt đầu từ dữ liệu trắng cho namespace mới.
