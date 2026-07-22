# Đưa App Online

App đã sẵn sàng để chạy online như PWA và đồng bộ dữ liệu giữa laptop/iPhone bằng Supabase.

## 1. Tạo Supabase

1. Vào `https://supabase.com` và tạo project mới.
2. Mở `SQL Editor`.
3. Copy toàn bộ nội dung file `supabase-schema.sql`.
4. Chạy SQL để tạo bảng `app_snapshots`.
5. Vào `Project Settings` > `API`.
6. Lấy `Project URL` và `anon public key`.

Lưu ý: snapshot được mã hóa trong trình duyệt bằng khóa đồng bộ bạn nhập trong app. Hãy dùng một khóa dài, khó đoán, ví dụ một câu 5-7 từ kèm số/ký tự.

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

Mở app > `Cài đặt` > nhập `Khóa đồng bộ` > `Lưu khóa đồng bộ`.

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
5. Vào `Cài đặt`, nhập cùng `Khóa đồng bộ` đã dùng trên laptop.

## 5. Quy tắc đồng bộ

- App tải snapshot cloud khi mở bằng một khóa đã lưu.
- App tự lưu lên cloud sau khi dữ liệu thay đổi.
- Khi hai thiết bị cùng sửa gần như đồng thời, bản lưu sau cùng sẽ thắng.
- Nếu nhập sai khóa đồng bộ, app không giải mã được snapshot cloud.
