import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ConnectionManagerService {
    private readonly logger = new Logger(ConnectionManagerService.name);

    // Bảng băm lưu trữ trong RAM: Map<userId, Set<socketId>>
    private readonly userSockets = new Map<string, Set<string>>();

    /**
     * Thêm một socket kết nối của người dùng vào bộ nhớ RAM
     * @returns isFirstConnection = true nếu đây là tab/thiết bị đầu tiên kết nối
     */
    addConnection(
        userId: string,
        socketId: string,
    ): { isFirstConnection: boolean; totalConnections: number } {
        let sockets = this.userSockets.get(userId);
        const isFirstConnection = !sockets || sockets.size === 0;

        if (!sockets) {
            sockets = new Set<string>();
            this.userSockets.set(userId, sockets);
        }

        sockets.add(socketId);

        this.logger.debug(
            `[Registry] User ${userId} kết nối socket ${socketId}. Tổng tab/thiết bị: ${sockets.size}`,
        );

        return {
            isFirstConnection,
            totalConnections: sockets.size,
        };
    }

    /**
     * Xóa một socket khi kết nối bị ngắt (tắt tab, mất mạng)
     * @returns isLastConnection = true nếu người dùng không còn bất kỳ tab nào khác (thực sự Offline)
     */
    removeConnection(
        userId: string,
        socketId: string,
    ): { isLastConnection: boolean; remainingConnections: number } {
        const sockets = this.userSockets.get(userId);

        if (!sockets) {
            return { isLastConnection: true, remainingConnections: 0 };
        }

        sockets.delete(socketId);

        if (sockets.size === 0) {
            this.userSockets.delete(userId);
            this.logger.debug(
                `[Registry] User ${userId} đã đóng tab cuối cùng. Chính thức chuyển sang OFFLINE.`,
            );
            return { isLastConnection: true, remainingConnections: 0 };
        }

        this.logger.debug(
            `[Registry] User ${userId} đóng socket ${socketId}. Vẫn còn ${sockets.size} tab khác đang mở (Vẫn ONLINE).`,
        );

        return { isLastConnection: false, remainingConnections: sockets.size };
    }

    /**
     * Lấy danh sách toàn bộ socketId đang hoạt động của một người dùng
     */
    getUserSockets(userId: string): Set<string> {
        return this.userSockets.get(userId) || new Set<string>();
    }

    /**
     * Kiểm tra một người dùng có đang Online hay không (có ít nhất 1 socket sống)
     */
    isUserOnline(userId: string): boolean {
        const sockets = this.userSockets.get(userId);
        return Boolean(sockets && sockets.size > 0);
    }

    /**
     * Lấy danh sách toàn bộ ID của các người dùng đang Online
     */
    getOnlineUserIds(): string[] {
        return Array.from(this.userSockets.keys());
    }

    /**
     * Đếm tổng số kết nối socket đang duy trì trên server
     */
    getTotalActiveSocketsCount(): number {
        let total = 0;
        for (const sockets of this.userSockets.values()) {
            total += sockets.size;
        }
        return total;
    }

    /**
     * Dọn sạch toàn bộ registry (dùng cho testing)
     */
    clear(): void {
        this.userSockets.clear();
    }
}
