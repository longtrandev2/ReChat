# ReChat — Frontend (React)

Single-page app của ReChat (React 19 + Vite + Zustand + Tailwind). Hướng dẫn cài đặt đầy đủ: xem [README gốc](../README.md); thiết kế giao diện: [`DESIGN.md`](../DESIGN.md); đặc tả: [`docs/SPEC.md`](../docs/SPEC.md).

## Lệnh thường dùng

```bash
cp .env.example .env   # VITE_API_BASE_URL, VITE_WS_URL
npm ci
npm run dev            # http://localhost:5173 (proxy /api và /socket.io tới :3000)
npm run build          # type-check (tsc -b) + build production
npm run lint           # eslint
npm test               # vitest + Testing Library
npm run test:cov       # test + coverage (report HTML trong coverage/)
```

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/features/auth` | Đăng nhập, đăng ký, OTP, 2FA, quên / đặt lại mật khẩu |
| `src/features/conversations` | Inbox sidebar, tạo nhóm, store hội thoại |
| `src/features/chat` | Khung chat, composer, bubble, drawer chi tiết, media |
| `src/features/friends` | Trung tâm bạn bè: danh sách, lời mời, chặn, tìm bạn |
| `src/features/settings` | Hồ sơ, đổi mật khẩu, 2FA, thiết bị & phiên |
| `src/services` | `api.client` (Axios + silent refresh có khóa & hàng đợi), `socket.client` |
| `src/stores`, `src/hooks`, `src/lib` | Auth store (token chỉ trong RAM), socket hook, tiện ích (device id, đồng bộ đa tab) |
