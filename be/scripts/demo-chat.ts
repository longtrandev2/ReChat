/**
 * Script mô phỏng trực quan 2 Client (User A và User B) chat Real-time qua WebSocket Gateway
 * Cách chạy:
 * 1. Khởi động backend server: npm run start:dev
 * 2. Mở terminal khác và chạy: npx tsx scripts/demo-chat.ts
 */
import { io, Socket } from 'socket.io-client';

const API_BASE = 'http://localhost:3000/api/v1';
const WS_URL = 'http://localhost:3000';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
    bold: '\x1b[1m',
};

async function loginOrRegister(username: string): Promise<{ token: string; user: any }> {
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password: 'password123' }),
        });
        if (res.ok) {
            const data = await res.json();
            return { token: data.accessToken, user: data.user };
        }
    } catch { }

    // Nếu chưa có tài khoản thì đăng ký mới
    const regRes = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username,
            password: 'password123',
            confirmPassword: 'password123',
        }),
    });
    const regData = await regRes.json();
    return { token: regData.accessToken, user: regData.user };
}

async function ensureFriendship(userA: { token: string; user: any }, userB: { token: string; user: any }) {
    try {
        const sendRes = await fetch(`${API_BASE}/friends/request/${userB.user.id}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${userA.token}` },
        });
        if (sendRes.ok) {
            const reqData = await sendRes.json();
            await fetch(`${API_BASE}/friends/requests/${reqData.id}/accept`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${userB.token}` },
            });
        }
    } catch {
        // Đã là bạn bè trước đó
    }
}

async function runDemo() {
    console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}🚀 BẮT ĐẦU MÔ PHỎNG CHAT REAL-TIME LAYER 5 (RECHAT)${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

    // 1. Đăng nhập 2 User
    console.log(`[1/6] 🔑 Đang đăng nhập User A (alex) và User B (bob)...`);
    const userA = await loginOrRegister('alex_demo');
    const userB = await loginOrRegister('bob_demo');

    console.log(`  -> User A: ${colors.green}${userA.user.username}${colors.reset} (ID: ${userA.user.id})`);
    console.log(`  -> User B: ${colors.green}${userB.user.username}${colors.reset} (ID: ${userB.user.id})\n`);

    // Đảm bảo 2 user là bạn bè để tạo được direct conversation theo luật BR-05
    await ensureFriendship(userA, userB);

    // 2. Tạo kết nối WebSocket cho User B trước
    console.log(`[2/6] 🌐 User B kết nối WebSocket...`);
    const socketB = io(WS_URL, {
        auth: { token: userB.token },
        transports: ['websocket'],
    });

    await new Promise<void>((resolve) => socketB.on('connect', resolve));
    console.log(`  -> User B đã Online! Socket ID: ${socketB.id}`);

    // B lắng nghe sự kiện hiện diện (Presence) của bạn bè
    socketB.on('userPresence', (data) => {
        console.log(`  📢 ${colors.yellow}[User B nhận Presence]${colors.reset} User ${data.userId} chuyển sang: ${data.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
    });

    // 3. User A kết nối WebSocket (kích hoạt Presence Online)
    console.log(`\n[3/6] 🌐 User A kết nối WebSocket...`);
    const socketA = io(WS_URL, {
        auth: { token: userA.token },
        transports: ['websocket'],
    });

    await new Promise<void>((resolve) => socketA.on('connect', resolve));
    console.log(`  -> User A đã Online! Socket ID: ${socketA.id}\n`);

    // 4. Tạo hoặc lấy cuộc hội thoại giữa A và B qua REST API
    const convRes = await fetch(`${API_BASE}/conversations/direct`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userA.token}`,
        },
        body: JSON.stringify({ targetUserId: userB.user.id }),
    });
    const conversation = await convRes.json();
    const convId = conversation.id;
    console.log(`[4/6] 💬 Cuộc hội thoại ID: ${colors.magenta}${convId}${colors.reset}`);

    // Cả 2 cùng join room
    await new Promise((r) => socketA.emit('joinConversation', { conversationId: convId }, r));
    await new Promise((r) => socketB.emit('joinConversation', { conversationId: convId }, r));
    console.log(`  -> Cả User A và User B đã join room conv_${convId}\n`);

    // 5. User A gõ phím (Typing) -> B nhận được kèm avatar & name
    console.log(`[5/6] ⌨️  User A bắt đầu gõ phím (typing)...`);
    socketB.on('userTyping', (typing) => {
        console.log(`  💬 ${colors.magenta}[User B thấy]${colors.reset} [Avatar: ${typing.avatarUrl || 'mặc định'}] ${colors.bold}${typing.displayName || typing.username}${colors.reset} đang soạn tin nhắn... (isTyping: ${typing.isTyping})`);
    });

    socketA.emit('typing', { conversationId: convId, isTyping: true });
    await new Promise((r) => setTimeout(r, 1000));

    // 6. User A gửi tin nhắn -> B nhận newMessage thời gian thực
    console.log(`\n[6/6] 📨 User A gửi tin nhắn: "Chào Bob, hệ thống Real-time chạy mượt quá!"`);
    socketB.on('newMessage', (msg) => {
        console.log(`  📩 ${colors.green}[User B nhận tin nhắn mới]${colors.reset}`);
        console.log(`     Người gửi: ${msg.sender.displayName || msg.sender.username}`);
        console.log(`     Nội dung: "${msg.content}"`);
        console.log(`     Thời gian: ${msg.createdAt}\n`);

        // User B lập tức gửi "Đã xem" (markAsRead)
        console.log(`  👀 User B đọc tin nhắn -> Gửi markAsRead...`);
        socketB.emit('markAsRead', { conversationId: convId });
    });

    socketA.on('messageRead', (receipt) => {
        console.log(`  ✅ ${colors.cyan}[User A nhận xác nhận Đã xem]${colors.reset}`);
        console.log(`     User ${receipt.displayName || receipt.username} đã xem đến tin nhắn: ${receipt.lastReadMessageId}`);
        console.log(`     Avatar nhỏ của người đọc: ${receipt.avatarUrl || 'mặc định'}\n`);

        console.log(`${colors.bold}${colors.green}🎉 DEMO HOÀN TẤT THÀNH CÔNG RỰC RỠ!${colors.reset}`);
        socketA.close();
        socketB.close();
        process.exit(0);
    });

    socketA.emit('sendMessage', {
        conversationId: convId,
        content: 'Chào Bob, hệ thống Real-time chạy mượt quá!',
    });
}

runDemo().catch((err) => {
    console.error('Lỗi khi chạy demo:', err);
    process.exit(1);
});
