# 📱 Sổ Thu Chi (Offline PWA cho iPhone)

Ứng dụng quản lý thu chi cá nhân phong cách Sổ Cái Kế Toán (Ledger), chuẩn thiết kế **Non-AI Design**, giao diện Dark Mode tối giản, lưu trữ offline 100% trên iPhone qua **IndexedDB**.

---

## 🚀 1. Chạy thử nghiệm ngay trên iPhone (cùng mạng Wi-Fi)

Mở terminal tại thư mục `d:\thuchi` và chạy:

```bash
npm run dev
```

Terminal sẽ hiện link mạng LAN (ví dụ: `http://192.168.x.x:3000`). Mở link này bằng trình duyệt Safari trên iPhone để trải nghiệm ngay.

---

## 🌐 2. Đưa lên mạng để dùng vĩnh viễn (Tắt máy tính vẫn dùng được)

Bạn chỉ cần đưa lên hosting miễn phí **1 lần duy nhất**:

### Cách tiện nhất: Dùng Vercel (Miễn phí)
Chạy lệnh sau tại terminal:
```bash
npx vercel
```
*Làm theo hướng dẫn trên màn hình (bấm Enter chọn mặc định).* Sau 30 giây, bạn sẽ nhận được một đường link (ví dụ: `https://thuchi.vercel.app`).

### Cài lên màn hình chính iPhone:
1. Mở đường link trên bằng trình duyệt **Safari** trên iPhone.
2. Bấm vào nút **Chia sẻ** (biểu tượng ô vuông có mũi tên chỉ lên ở thanh công cụ dưới).
3. Chọn **"Thêm vào Màn hình chính" (Add to Home Screen)**.
4. Bấm **Thêm (Add)**.

👉 Ứng dụng sẽ xuất hiện như 1 app native trên màn hình iPhone, mở lên toàn màn hình (không có thanh URL của web), hoạt động offline hoàn toàn ngay cả khi bật chế độ máy bay, và bạn có thể **tắt máy tính đi vĩnh viễn**.

---

## 🛡️ 3. An toàn dữ liệu & Sao lưu
- Dữ liệu lưu trong bộ nhớ **IndexedDB** của máy bạn, riêng tư tuyệt đối.
- Vào tab **Cài đặt** > Có sẵn nút **"Tải file sao lưu (JSON)"** và **"Khôi phục file"** để bạn chuyển dữ liệu sang máy mới bất cứ lúc nào.
