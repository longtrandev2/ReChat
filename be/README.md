# ReChat — Backend (NestJS)

REST API + WebSocket gateway của ReChat. Hướng dẫn cài đặt đầy đủ, biến môi trường và kiến trúc: xem [README gốc](../README.md); đặc tả nghiệp vụ: [`docs/SPEC.md`](../docs/SPEC.md).

## Lệnh thường dùng

```bash
npm ci                 # cài dependencies
npm run start:dev      # chạy dev (watch) — http://localhost:3000/api/v1, Swagger: /api/docs
npm run build          # build production (dist/)
npm run lint           # oxlint
npm test               # unit test (không cần DB)
npm run test:cov       # unit test + coverage
npm run test:e2e       # e2e — cần MySQL + Redis: `docker compose up -d mysql redis` ở thư mục gốc
```

Backend đọc `../.env` (thư mục gốc) trước, sau đó tới `be/.env`.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/modules/auth` | Đăng ký / OTP / đăng nhập, refresh token rotation, 2FA, phiên đa thiết bị, đổi / đặt lại mật khẩu |
| `src/modules/users` | Hồ sơ cá nhân, tìm kiếm người dùng (chỉ trả trường công khai) |
| `src/modules/friends` | Lời mời kết bạn, danh sách bạn bè, chặn / bỏ chặn |
| `src/modules/conversations` | Hội thoại 1-1 / nhóm, tin nhắn, reaction, ghim, tìm kiếm, `gateway/` (Socket.IO) |
| `src/modules/media` | Upload Cloudinary, tự động phát tin nhắn media |
| `src/common` | Kiểm tra thu hồi token, config (JWT secret, CORS), domain events, filter / interceptor, Redis, mail queue |
| `test/` | E2E: auth lifecycle, session revocation, 2FA, conversation access & pagination, realtime |
