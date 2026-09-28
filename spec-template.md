# SPEC.md — QuickChat (Real-time Chat App)

**Version:** 1.0 · **Ngày:** 27/09/2026 · **Trạng thái:** [x] Draft → [x] Approved

## 1. Tổng quan

Xây dựng ứng dụng web chat thời gian thực (real-time chat) cho người dùng cá nhân để gửi/nhận tin nhắn tức thì trong các phòng chat công khai (Public) và riêng tư (Private).

## 2. Vai trò (Actors)

| Role | Quyền |
|---|---|
| **Guest** | Đăng ký tài khoản, Đăng nhập hệ thống. |
| **User** | Xem danh sách phòng, tạo phòng chat (Public/Private), tham gia/rời phòng, gửi/nhận tin nhắn real-time, xem lịch sử tin nhắn. |

## 3. Functional Requirements

| ID | Yêu cầu |
|----|---------|
| FR-01 | Đăng ký tài khoản mới bằng Username và Password. |
| FR-02 | Đăng nhập hệ thống để nhận JWT Token. |
| FR-03 | Xem danh sách các phòng chat hiện có. |
| FR-04 | Tạo phòng chat mới (Public hoặc Private có mật khẩu). |
| FR-05 | Tham gia và rời phòng chat. |
| FR-06 | Gửi và nhận tin nhắn thời gian thực trong phòng chat. |
| FR-07 | Xem lịch sử tin nhắn của một phòng chat. |
| FR-08 | Hiển thị thông báo khi có người dùng đang gõ tin nhắn (Typing indicator) và danh sách người dùng online trong phòng. |

## 4. Business Rules ⭐ PHẦN QUAN TRỌNG NHẤT

| ID | Rule | Liên quan FR | Lỗi khi vi phạm |
|----|------|--------------|-----------------|
| BR-01 | `username` là duy nhất, độ dài từ 3 đến 20 ký tự, chỉ chứa chữ cái, chữ số và gạch dưới `_`. | FR-01 | `409 Conflict` (trùng name) hoặc `400 Bad Request` (sai format) |
| BR-02 | `password` phải có độ dài tối thiểu từ 6 ký tự. | FR-01, FR-02 | `400 Bad Request` |
| BR-03 | `room name` là duy nhất, độ dài từ 3 đến 30 ký tự. | FR-04 | `409 Conflict` |
| BR-04 | Phòng `isPrivate = true` bắt buộc phải có mật khẩu phòng (`room password` từ 4-12 ký tự). Người dùng phải nhập đúng mật khẩu phòng mới được join vào phòng private. | FR-04, FR-05 | `403 Forbidden` |
| BR-05 | Tin nhắn (`content`) không được để rỗng và có độ dài tối đa 1000 ký tự. | FR-06 | `400 Bad Request` / WS Event `exception` |
| BR-06 | Mọi request API (trừ Register/Login) và kết nối WebSocket phải có JWT Token hợp lệ (Bearer Token hoặc Socket Handshake Auth). | FR-03 -> FR-08 | `401 Unauthorized` |
| BR-07 | Lấy lịch sử tin nhắn mặc định lấy tối đa 50 tin nhắn mới nhất, sắp xếp theo thời gian tăng dần (`createdAt ASC`). | FR-07 | `400 Bad Request` (nếu truyền limit sai) |
| BR-08 | Người dùng không thể join cùng 1 phòng nhiều lần trên cùng 1 socket (Chống double-join). | FR-05 | `400 Bad Request` / WS Event `exception` |

## 5. API Endpoints

| Method | Path | Mô tả | Auth | Rules |
|--------|------|-------|------|-------|
| `POST` | `/auth/register` | Đăng ký tài khoản | None | BR-01, BR-02 |
| `POST` | `/auth/login` | Đăng nhập lấy JWT access token | None | BR-02 |
| `GET` | `/auth/me` | Lấy thông tin user đang đăng nhập | Bearer JWT | BR-06 |
| `GET` | `/rooms` | Lấy danh sách tất cả các phòng chat | Bearer JWT | BR-06 |
| `POST` | `/rooms` | Tạo phòng chat mới | Bearer JWT | BR-03, BR-04, BR-06 |
| `GET` | `/rooms/:id/messages` | Lấy 50 tin nhắn gần nhất của phòng | Bearer JWT | BR-06, BR-07 |
| `POST` | `/rooms/:id/join` | Xác thực mật khẩu để gia nhập phòng private | Bearer JWT | BR-04, BR-06, BR-08 |

## 6. WebSocket Events

| Hướng | Event | Payload | Người nhận | Rule refs |
|-------|-------|---------|-----------|-----------|
| Client -> Server | `joinRoom` | `{ roomId: string, password?: string }` | Server | BR-04, BR-08 |
| Client -> Server | `leaveRoom` | `{ roomId: string }` | Server | BR-06 |
| Client -> Server | `sendMessage` | `{ roomId: string, content: string }` | Server | BR-05, BR-06 |
| Client -> Server | `typing` | `{ roomId: string, isTyping: boolean }` | Server | BR-06 |
| Server -> Client | `newMessage` | `{ id: string, content: string, sender: { id: string, username: string }, roomId: string, createdAt: string }` | Cả Room (`roomId`) | BR-05 |
| Server -> Client | `userTyping` | `{ userId: string, username: string, isTyping: boolean }` | Người khác trong Room | N/A |
| Server -> Client | `roomUsers` | `{ roomId: string, users: Array<{ id: string, username: string }> }` | Cả Room (`roomId`) | N/A |
| Server -> Client | `exception` | `{ status: string, message: string }` | Sender Socket | BR-01 -> BR-08 |

## 7. Mô hình dữ liệu

- **User Entity**:
  - `id`: string (UUID, Primary Key)
  - `username`: string (VARCHAR 20, Unique, Not Null)
  - `password`: string (VARCHAR 255, Hashed với bcrypt)
  - `createdAt`: Date (DATETIME, default NOW)

- **Room Entity**:
  - `id`: string (UUID, Primary Key)
  - `name`: string (VARCHAR 30, Unique, Not Null)
  - `isPrivate`: boolean (Default false)
  - `password`: string (VARCHAR 255, Nullable - hashed nếu private)
  - `createdAt`: Date (DATETIME, default NOW)

- **Message Entity**:
  - `id`: string (UUID, Primary Key)
  - `content`: string (TEXT, Not Null)
  - `senderId`: string (UUID, Foreign Key -> User.id)
  - `roomId`: string (UUID, Foreign Key -> Room.id)
  - `createdAt`: Date (DATETIME, default NOW)

**Quan hệ**:
- `User` 1 — N `Message` (`user.messages`)
- `Room` 1 — N `Message` (`room.messages`)

## 8. Validation & Error Handling

- **Validation**: Sử dụng `ValidationPipe` toàn cục (`app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`) kết hợp với `class-validator` và `class-transformer` trên DTO.
- **HTTP Error Format**:
  ```json
  {
    "statusCode": 400,
    "message": ["username must be at least 3 characters long"],
    "error": "Bad Request",
    "timestamp": "2026-09-27T23:00:00.000Z",
    "path": "/auth/register"
  }
  ```
- **WebSocket Error Format**: Sử dụng Custom `WsExceptionFilter` để catch lỗi WS và trả về event `exception`:
  ```json
  {
    "status": "error",
    "message": "Content cannot be empty"
  }
  ```

## 9. Yêu cầu phi chức năng

- **Unit Test Coverage**: Mục tiêu ≥ 70% coverage cho Auth Module, Room Module và Chat Gateway.
- **Môi trường**:
  - Node.js: >= 20.x
  - NestJS: 10.x
  - Database: SQLite (cho dev/test nhanh) hoặc PostgreSQL (cho docker).
  - Client: React 18 + Vite + TypeScript + Socket.io-client.

## 10. Out of Scope

- Chat 1-1 riêng tư giữa 2 cá nhân (Direct Messaging).
- Upload file, hình ảnh, voice message.
- Trạng thái tin nhắn đã đọc/chưa đọc (Read receipts).
- Quên mật khẩu, đổi avatar, xác thực email.

## 11. Edge cases đã nghĩ tới

| Tình huống bất thường | Xử lý |
|---|---|
| Socket bị ngắt kết nối đột ngột (Disconnect tab / mất mạng) | Gateway tự dọn dẹp socket khỏi room và broadcast lại danh sách `roomUsers` mới nhất. |
| User gửi tin nhắn chứa toàn khoảng trắng (`"   "`) | DTO / Service trim string và bắn lỗi BR-05 (`content không được rỗng`). |
| Hai user cùng đăng ký 1 `username` tại cùng 1 thời điểm | Database Unique Constraint phát hiện trùng, CatchQueryFailedException map sang HTTP `409 Conflict`. |
| Client kết nối Socket truyền Token JWT hết hạn | `OnGatewayConnection` verify token thất bại, chủ động gọi `client.disconnect(true)`. |
| Gửi tin nhắn tới `roomId` không tồn tại trong DB | WS Exception Filter bắt lỗi `NotFoundException` và emit event `exception` về cho client. |

---

## Self-review trước khi xin approve (Gate 1) — tự tick

- [x] Mỗi BR viết thành 1 unit test được chưa?
- [x] BR nào còn mơ hồ, thiếu số cụ thể?
- [x] FR nào thiếu endpoint/event để hoàn thành?
- [x] Có 2 rule nào mâu thuẫn nhau không?
- [x] Out of scope có đủ để xong trong 4 ngày × 3h không?
