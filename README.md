# ReChat — Real-time Web Messenger

Ứng dụng nhắn tin thời gian thực kiểu Messenger / Telegram Web: chat 1-1 và nhóm, bạn bè & chặn, rich messaging (reply, reaction, thu hồi, chỉnh sửa, ghim, media), xác thực nhiều lớp (Email OTP, 2FA, quản lý phiên đa thiết bị).

Dự án được phát triển theo quy trình **Spec-Driven Development (SDD)**: mọi tính năng bắt đầu từ [`docs/SPEC.md`](docs/SPEC.md) (Functional Requirements + Business Rules), sau đó mới tới code và test ánh xạ ngược về từng rule.

---

## Mục lục
1. [Tính năng chính](#tính-năng-chính)
2. [Tech stack](#tech-stack)
3. [Kiến trúc](#kiến-trúc)
4. [Cấu trúc thư mục](#cấu-trúc-thư-mục)
5. [Chạy dự án](#chạy-dự-án)
6. [Biến môi trường](#biến-môi-trường)
7. [Kiểm thử & chất lượng](#kiểm-thử--chất-lượng)
8. [Quy trình làm việc](#quy-trình-làm-việc)
9. [Tài liệu](#tài-liệu)
10. [Giới hạn đã biết](#giới-hạn-đã-biết)

---

## Tính năng chính

| Nhóm | Tính năng |
|---|---|
| **Xác thực & bảo mật** | Đăng ký + xác thực email OTP · đăng nhập bằng username hoặc email · quên / đặt lại / đổi mật khẩu · 2FA qua email OTP · Access Token 15 phút trong RAM + Refresh Token HttpOnly cookie xoay vòng (RTR, phát hiện tái sử dụng token) · ràng buộc thiết bị (`X-Device-Id`) · quản lý phiên đa thiết bị, đăng xuất từ xa (thu hồi ngay cả access token và WebSocket) · rate limit phân tán trên Redis |
| **Bạn bè** | Tìm kiếm người dùng · gửi / nhận / hủy / từ chối lời mời · danh sách bạn bè kèm trạng thái online · chặn / bỏ chặn |
| **Hội thoại** | Chat 1-1 và nhóm · quản lý thành viên & vai trò (Owner / Admin / Member) · inbox realtime với badge chưa đọc · ghim / xóa đoạn chat · tắt thông báo · tìm kiếm trong hội thoại |
| **Tin nhắn** | Gửi realtime qua WebSocket (ACK) · phân trang con trỏ · reply · reaction · chỉnh sửa (15 phút) · thu hồi · ghim · gửi ảnh / tệp (Cloudinary) · tin nhắn hệ thống · typing & đã xem |
| **Cài đặt** | Hồ sơ (avatar, tên hiển thị) · đổi mật khẩu · bật / tắt 2FA · danh sách thiết bị đang đăng nhập |

## Tech stack

| Tầng | Công nghệ |
|---|---|
| Backend | NestJS 11 · TypeScript · TypeORM (MySQL 8) · Passport JWT · Socket.IO + Redis adapter · BullMQ (hàng đợi email) · Nodemailer · Cloudinary · Swagger |
| Frontend | React 19 · Vite · TypeScript · Zustand · React Hook Form + Zod · Radix UI · Tailwind CSS · socket.io-client |
| Hạ tầng | Docker Compose (MySQL 8, Redis 7, Adminer) |
| Kiểm thử | Vitest · Testing Library · Supertest (e2e với MySQL + Redis thật) |

## Kiến trúc

```
┌──────────────── Browser (React SPA) ─────────────────┐
│ Zustand stores · Axios (silent refresh + queue)      │
│ socket.io-client · BroadcastChannel (đồng bộ đa tab) │
└───────────────┬───────────────────────┬──────────────┘
         REST /api/v1             WebSocket (JWT handshake)
                │                       │
┌───────────────▼───────────────────────▼──────────────┐
│ NestJS: Auth · Users · Friends · Conversations · Media│
│ Domain events (EventEmitter) ──▶ ChatGateway (rooms)  │
└──────┬──────────────┬────────────────┬───────────────┘
       │              │                │
   MySQL 8        Redis 7          Cloudinary / SMTP
 (dữ liệu)  (session, token family, (file, email qua BullMQ)
            blacklist, rate limit,
            Socket.IO adapter, queue)
```

- **Realtime**: mỗi user có room `user_{id}` (đồng bộ đa tab / đa thiết bị), mỗi thiết bị có room `device_{userId}_{deviceId}` (để thu hồi phiên), mỗi hội thoại có room `conv_{id}`. Gửi tin nhắn = lưu DB → broadcast → trả ACK (DB là nguồn sự thật).
- **Event-driven**: service phát domain event (`message.created`, `friend.*`, `inbox.updated`, `auth.sessions_revoked`…), gateway chỉ lắng nghe và fan-out — module nghiệp vụ không phụ thuộc WebSocket.
- Chi tiết: [`docs/SPEC.md`](docs/SPEC.md) mục 5 (API), 6 (WebSocket), 7 (schema).

## Cấu trúc thư mục

```
ReChat/
├── be/                         # NestJS backend
│   ├── src/
│   │   ├── common/             # auth helpers, config, events, filters, guards, redis, mail
│   │   ├── modules/            # auth · users · friends · conversations (+ gateway) · media
│   │   ├── app.setup.ts        # HTTP pipeline dùng chung cho main.ts và e2e
│   │   └── main.ts
│   └── test/                   # e2e test (cần MySQL + Redis)
├── fe/                         # React frontend
│   └── src/
│       ├── features/           # auth · chat · conversations · friends · settings · users
│       ├── components/         # layout, ui primitives
│       ├── services/ stores/ hooks/ lib/
├── docs/SPEC.md                # Đặc tả: FR, BR, API, WS events, schema, edge cases
├── DESIGN.md                   # Design system (Telegram / Messenger)
├── docker-compose.yml          # MySQL, Redis, Adminer
└── .env.example
```

## Chạy dự án

### Yêu cầu
- Node.js **≥ 20** (đã kiểm thử trên Node 24) và npm
- Docker Desktop (cho MySQL + Redis)

### 1. Clone & cấu hình môi trường
```bash
git clone https://github.com/longtrandev2/ReChat.git
cd ReChat
cp .env.example .env          # dùng chung cho docker-compose và backend
cp fe/.env.example fe/.env
```
Mở `.env`, đặt `JWT_SECRET` (≥ 32 ký tự). Muốn nhận email OTP thật thì điền `SMTP_*`; muốn upload ảnh / tệp thì điền `CLOUDINARY_*`.

### 2. Khởi động hạ tầng
```bash
docker compose up -d mysql redis adminer
```
> `MYSQL_USER` không được là `root` (image `mysql:8` từ chối). Nếu đổi user / password sau lần chạy đầu: `docker compose down -v` (xóa dữ liệu local) rồi chạy lại.

### 3. Backend
```bash
cd be
npm ci
npm run start:dev             # http://localhost:3000/api/v1
```
Schema được TypeORM tự đồng bộ (`synchronize: true`). Swagger: http://localhost:3000/api/docs

### 4. Frontend
```bash
cd fe
npm ci
npm run dev                   # http://localhost:5173
```

| Dịch vụ | URL |
|---|---|
| Web app | http://localhost:5173 |
| REST API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/api/docs |
| Adminer (MySQL UI) | http://localhost:8080 |

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `PORT`, `NODE_ENV` | ✔ | Cổng API (mặc định 3000), môi trường |
| `CLIENT_URL` | ✔ | Origin của web app; nhiều origin phân tách bằng dấu phẩy (CORS whitelist). Origin đầu tiên dùng cho link trong email |
| `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE` | ✔ | Kết nối MySQL (user thường, không phải root) |
| `MYSQL_ROOT_PASSWORD`, `ADMINER_PORT` | ✔ (Docker) | Chỉ dùng cho container MySQL / Adminer |
| `REDIS_HOST/PORT/PASSWORD` | ✔ | Redis cho session, token, rate limit, queue, Socket.IO adapter |
| `JWT_SECRET` | ✔ | Bắt buộc ở production (app từ chối khởi động nếu thiếu) |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | Khi cần email | OTP đăng ký, 2FA, đặt lại mật khẩu |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | Khi cần upload | Avatar, ảnh, tệp đính kèm |
| `VITE_API_BASE_URL`, `VITE_WS_URL` (`fe/.env`) | ✔ | Địa chỉ API và WebSocket cho frontend |

Không commit `.env` — chỉ commit `.env.example`.

## Kiểm thử & chất lượng

| Lệnh | Mô tả |
|---|---|
| `cd be && npm test` | Unit test backend (không cần DB) |
| `cd be && npm run test:cov` | Unit test + coverage |
| `cd be && npm run test:e2e` | E2E với MySQL + Redis thật (chạy bước 2 trước) |
| `cd fe && npm test` | Unit / component test frontend |
| `cd fe && npm run test:cov` | Test + coverage frontend |
| `npm run lint` · `npm run build` | Lint và build (chạy trong `be/` hoặc `fe/`) |

**E2E bao phủ các flow quan trọng:** vòng đời xác thực (đăng ký → OTP → đăng nhập → refresh xoay vòng → phát hiện tái sử dụng token → đăng xuất), thu hồi phiên đa thiết bị (đăng xuất từ xa, đổi / đặt lại mật khẩu, ngắt socket), 2FA (chống brute-force), phân quyền hội thoại & phân trang con trỏ, realtime (handshake, presence, typing, read receipt), rich messaging.

<!-- QUALITY-NUMBERS:START -->
| Chỉ số (02/11/2026) | Backend | Frontend |
|---|---|---|
| Unit / component test | 530 test · 30 file | 484 test · 62 file |
| E2E (MySQL + Redis thật) | 34 test · 8 file | — |
| Coverage statements / branches | 89.8% / 80.3% | 74.7% / 66.8% |
| Lint · type-check · build | sạch | sạch |
<!-- QUALITY-NUMBERS:END -->

Ánh xạ Business Rule → test: xem mục *Traceability* trong [`docs/SPEC.md`](docs/SPEC.md).

## Quy trình làm việc

1. **Spec trước** — thêm / sửa FR, BR, API trong `docs/SPEC.md`, review trước khi code.
2. **Nhánh** — `feat/<scope>`, `fix/<scope>`, `docs/<scope>` tách từ `develop`.
3. **Commit** — Conventional Commits (`feat(auth): …`, `fix(chat): …`, `docs(spec): …`).
4. **Test** — mỗi BR có unit test; flow quan trọng có e2e. Không merge khi test đỏ.
5. **Pull Request** — vào `develop` theo [PR template](.github/pull_request_template.md) (mô tả, kết quả build / lint / test). `develop` → `main` khi chốt release.

## Tài liệu
- [`docs/SPEC.md`](docs/SPEC.md) — đặc tả hệ thống (nguồn sự thật duy nhất)
- [`DESIGN.md`](DESIGN.md) — design system giao diện
- Swagger UI — http://localhost:3000/api/docs khi chạy backend

## Giới hạn đã biết
- Schema dùng `synchronize: true` (phù hợp môi trường học tập / dev); production cần chuyển sang TypeORM migrations.
- Trạng thái online được theo dõi trong bộ nhớ từng instance: chạy nhiều instance backend cần chuyển registry kết nối sang Redis.
- Thiết bị bị đăng xuất từ xa bị ngắt socket ngay, nhưng giao diện chỉ chuyển về màn hình đăng nhập ở lần gọi API kế tiếp.
