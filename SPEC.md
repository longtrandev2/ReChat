# SPEC.md — QuickChat (Real-time Chat App)

**Version:** 1.1 · **Ngày:** 29/09/2026 · **Trạng thái:** [x] Draft → [x] Approved

## 1. Tổng quan

Xây dựng ứng dụng web chat thời gian thực (real-time chat) cho người dùng cá nhân để gửi/nhận tin nhắn tức thì trong các phòng chat công khai (Public) và riêng tư (Private) với quản lý thành viên chuẩn xác.

## 2. Vai trò (Actors)

| Role | Quyền |
|---|---|
| **Guest** | Đăng ký tài khoản, Đăng nhập hệ thống. |
| **User** | Xem danh sách phòng, tạo phòng (Owner), gia nhập/rời phòng (Member), gửi/nhận tin nhắn real-time trong phòng đã join, xem lịch sử tin nhắn của phòng đã tham gia. |

## 3. Functional Requirements

| ID | Yêu cầu |
|----|---------|
| FR-01 | Đăng ký tài khoản mới bằng Username và Password. |
| FR-02 | Đăng nhập hệ thống để nhận JWT Token. |
| FR-03 | Xem danh sách các phòng chat hiện có trong hệ thống (All Rooms). |
| FR-04 | Tạo phòng chat mới (Public hoặc Private có mật khẩu). Người tạo tự động thành OWNER. |
| FR-05 | Tham gia (Join) và rời (Leave) phòng chat. Thông tin tham gia được lưu trữ vào CSDL. |
| FR-06 | Xem danh sách các phòng chat mà bản thân ĐÃ GIA NHẬP (Joined Rooms). |
| FR-07 | Gửi và nhận tin nhắn thời gian thực trong các phòng mà mình đã tham gia. |
| FR-08 | Xem lịch sử tin nhắn của một phòng chat (Chỉ áp dụng với thành viên phòng). |
| FR-09 | Hiển thị thông báo khi có người dùng đang gõ tin nhắn (Typing indicator) và danh sách người dùng online trong phòng. |

## 4. Business Rules ⭐ PHẦN QUAN TRỌNG NHẤT

| ID | Rule | Liên quan FR | Lỗi khi vi phạm |
|----|------|--------------|-----------------|
| BR-01 | `username` là duy nhất, độ dài từ 3 đến 20 ký tự, chỉ chứa chữ cái, chữ số và gạch dưới `_`. | FR-01 | `409 Conflict` (trùng name) hoặc `400 Bad Request` (sai format) |
| BR-02 | `password` phải có độ dài tối thiểu từ 6 ký tự. | FR-01, FR-02 | `400 Bad Request` |
| BR-03 | `room name` là duy nhất, độ dài từ 3 đến 30 ký tự. | FR-04 | `409 Conflict` |
| BR-04 | Phòng `isPrivate = true` bắt buộc phải có mật khẩu phòng (`room password` từ 4-12 ký tự). Người dùng phải nhập đúng mật khẩu mới được Join. | FR-04, FR-05 | `403 Forbidden` |
| BR-05 | Khi tạo phòng mới, hệ thống tự động chèn bản ghi vào `RoomMember` gắn `userId` người tạo với `role = OWNER`. | FR-04 | `500 Internal Error` |
| BR-06 | Chỉ người dùng ĐÃ GIA NHẬP phòng (có record trong `RoomMember`) mới được lấy lịch sử tin nhắn và gửi/nhận WebSocket message trong phòng đó. | FR-07, FR-08 | `403 Forbidden` |
| BR-07 | Tin nhắn (`content`) không được để rỗng và có độ dài tối đa 1000 ký tự. | FR-07 | `400 Bad Request` / WS Event `exception` |
| BR-08 | Mọi request API (trừ Register/Login) và kết nối WebSocket phải có JWT Token hợp lệ. | FR-03 -> FR-09 | `401 Unauthorized` |
| BR-09 | Lấy lịch sử tin nhắn mặc định tối đa 50 tin nhắn mới nhất, sắp xếp theo thời gian tăng dần (`createdAt ASC`). | FR-08 | `400 Bad Request` |
| BR-10 | Người dùng không thể join lại phòng mà mình đã là thành viên trong DB (Chống double-join). | FR-05 | `400 Bad Request` |

## 5. API Endpoints

| Method | Path | Mô tả | Auth | Rules |
|--------|------|-------|------|-------|
| `POST` | `/auth/register` | Đăng ký tài khoản | None | BR-01, BR-02 |
| `POST` | `/auth/login` | Đăng nhập lấy JWT access token | None | BR-02 |
| `GET` | `/auth/me` | Lấy thông tin user đang đăng nhập | Bearer JWT | BR-08 |
| `GET` | `/rooms` | Lấy danh sách tất cả các phòng chat | Bearer JWT | BR-08 |
| `GET` | `/rooms/joined` | Lấy danh sách phòng mà TÔI ĐÃ GIA NHẬP | Bearer JWT | BR-08 |
| `POST` | `/rooms` | Tạo phòng chat mới (Người tạo tự động thành OWNER) | Bearer JWT | BR-03, BR-04, BR-05, BR-08 |
| `POST` | `/rooms/:id/join` | Tham gia phòng (Kiểm tra mật khẩu nếu private, lưu vào RoomMember) | Bearer JWT | BR-04, BR-08, BR-10 |
| `POST` | `/rooms/:id/leave` | Rời phòng (Xóa khỏi RoomMember) | Bearer JWT | BR-08 |
| `GET` | `/rooms/:id/messages` | Lấy 50 tin nhắn gần nhất của phòng (Chỉ cho Member) | Bearer JWT | BR-06, BR-08, BR-09 |

## 6. WebSocket Events

| Hướng | Event | Payload | Người nhận | Rule refs |
|-------|-------|---------|-----------|-----------|
| Client -> Server | `joinRoom` | `{ roomId: string }` | Server | BR-06, BR-10 |
| Client -> Server | `leaveRoom` | `{ roomId: string }` | Server | BR-08 |
| Client -> Server | `sendMessage` | `{ roomId: string, content: string }` | Server | BR-06, BR-07 |
| Client -> Server | `typing` | `{ roomId: string, isTyping: boolean }` | Server | BR-06 |
| Server -> Client | `newMessage` | `{ id: string, content: string, sender: { id: string, username: string }, roomId: string, createdAt: string }` | Cả Room (`roomId`) | BR-07 |
| Server -> Client | `userTyping` | `{ userId: string, username: string, isTyping: boolean }` | Người khác trong Room | N/A |
| Server -> Client | `roomUsers` | `{ roomId: string, users: Array<{ id: string, username: string }> }` | Cả Room (`roomId`) | N/A |
| Server -> Client | `exception` | `{ status: string, message: string }` | Sender Socket | BR-01 -> BR-10 |

## 7. Mô hình dữ liệu

- **User Entity**:
  - `id`: string (UUID, Primary Key)
  - `username`: string (VARCHAR 20, Unique, Not Null)
  - `password`: string (VARCHAR 255, Hashed với bcrypt)
  - `createdAt`: Date (DATETIME)
  - `updatedAt`: Date (DATETIME)

- **Room Entity**:
  - `id`: string (UUID, Primary Key)
  - `name`: string (VARCHAR 30, Unique, Not Null)
  - `isPrivate`: boolean (Default false)
  - `password`: string (VARCHAR 255, Nullable - hashed nếu private)
  - `createdAt`: Date (DATETIME)
  - `updatedAt`: Date (DATETIME)

- **RoomMember Entity** (Bảng trung gian N-N):
  - `id`: string (UUID, Primary Key)
  - `userId`: string (UUID, Foreign Key -> User.id)
  - `roomId`: string (UUID, Foreign Key -> Room.id)
  - `role`: enum (`'OWNER'`, `'MEMBER'`)
  - `joinedAt`: Date (DATETIME)

- **Message Entity**:
  - `id`: string (UUID, Primary Key)
  - `content`: string (TEXT, Not Null)
  - `senderId`: string (UUID, Foreign Key -> User.id)
  - `roomId`: string (UUID, Foreign Key -> Room.id)
  - `createdAt`: Date (DATETIME)

**Quan hệ**:
- `User` 1 ─── N `RoomMember` N ─── 1 `Room`
- `User` 1 ─── N `Message`
- `Room` 1 ─── N `Message`

## 8. Validation & Error Handling

- **Validation**: Sử dụng `ValidationPipe` toàn cục kết hợp với `class-validator`.
- **HTTP Error Format**:
  ```json
  {
    "statusCode": 403,
    "message": "You are not a member of this room",
    "error": "Forbidden",
    "timestamp": "2026-09-29T13:30:00.000Z",
    "path": "/rooms/room-uuid/messages"
  }
  ```
- **WebSocket Error Format**: Custom `WsExceptionFilter` trả về event `exception`.

## 9. Yêu cầu phi chức năng

- **Unit Test Coverage**: Mục tiêu ≥ 70% coverage cho Auth, Room Service & Access Control logic.
- **Môi trường**:
  - Node.js >= 20.x, NestJS 10.x, MySQL 8.0 (Docker).
  - Client: React 18 + Vite + TypeScript + Socket.io-client.

## 10. Out of Scope

- Chat 1-1 riêng tư (Direct Messaging).
- Upload file / hình ảnh.
- Status tin nhắn đã đọc/chưa đọc.
- Phân quyền xóa tin nhắn / Kick thành viên khỏi room (giữ scope vừa sức).

## 11. Edge cases đã nghĩ tới

| Tình huống bất thường | Xử lý |
|---|---|
| User chưa Join room gửi API lấy lịch sử tin nhắn | Controller check `RoomMember`, bắn lỗi `403 Forbidden`. |
| User chưa Join room gửi event `sendMessage` qua WebSocket | ChatGateway check membership, emit `exception` ("Not a member"). |
| Người tạo phòng rời phòng | Gán quyền OWNER cho member tiếp theo hoặc giữ nguyên nguyên tắc đơn giản. |
| Socket bị ngắt kết nối đột ngột | Tự dọn dẹp khỏi RAM online list mà không xóa record trong DB `RoomMember`. |

---

## Self-review trước khi xin approve (Gate 1) — tự tick

- [x] Mỗi BR viết thành 1 unit test được chưa?
- [x] BR nào còn mơ hồ, thiếu số cụ thể?
- [x] FR nào thiếu endpoint/event để hoàn thành?
- [x] Có 2 rule nào mâu thuẫn nhau không?
- [x] Out of scope có đủ để xong trong 4 ngày × 3h không?
