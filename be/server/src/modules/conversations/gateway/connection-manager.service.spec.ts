import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionManagerService } from './connection-manager.service.js';

describe('ConnectionManagerService (Stateful Memory Registry)', () => {
    let service: ConnectionManagerService;

    beforeEach(() => {
        service = new ConnectionManagerService();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('addConnection & Multi-device tracking', () => {
        it('should mark isFirstConnection as true on the very first tab of a user', () => {
            const result = service.addConnection('user-1', 'socket-tab-1');
            expect(result.isFirstConnection).toBe(true);
            expect(result.totalConnections).toBe(1);
            expect(service.isUserOnline('user-1')).toBe(true);
        });

        it('should mark isFirstConnection as false when user opens a second tab', () => {
            service.addConnection('user-1', 'socket-tab-1');
            const result = service.addConnection('user-1', 'socket-tab-2');

            expect(result.isFirstConnection).toBe(false);
            expect(result.totalConnections).toBe(2);
            expect(service.isUserOnline('user-1')).toBe(true);
        });

        it('should track multiple users independently', () => {
            service.addConnection('user-1', 'socket-u1-t1');
            service.addConnection('user-1', 'socket-u1-t2');
            const resultU2 = service.addConnection('user-2', 'socket-u2-t1');

            expect(resultU2.isFirstConnection).toBe(true);
            expect(service.getOnlineUserIds()).toEqual(['user-1', 'user-2']);
            expect(service.getTotalActiveSocketsCount()).toBe(3);
        });
    });

    describe('removeConnection & Offline detection', () => {
        it('should not mark isLastConnection as true if other tabs are still open', () => {
            service.addConnection('user-1', 'socket-tab-1');
            service.addConnection('user-1', 'socket-tab-2');

            // User closes tab 1
            const result = service.removeConnection('user-1', 'socket-tab-1');

            expect(result.isLastConnection).toBe(false);
            expect(result.remainingConnections).toBe(1);
            expect(service.isUserOnline('user-1')).toBe(true); // Still online!
        });

        it('should mark isLastConnection as true and delete user from map when the last tab is closed', () => {
            service.addConnection('user-1', 'socket-tab-1');

            // User closes the only tab
            const result = service.removeConnection('user-1', 'socket-tab-1');

            expect(result.isLastConnection).toBe(true);
            expect(result.remainingConnections).toBe(0);
            expect(service.isUserOnline('user-1')).toBe(false); // Truly offline!
            expect(service.getOnlineUserIds()).toEqual([]);
        });

        it('should handle removing a connection from non-existent user gracefully', () => {
            const result = service.removeConnection('non-existent', 'socket-unknown');
            expect(result.isLastConnection).toBe(true);
            expect(result.remainingConnections).toBe(0);
        });
    });

    describe('getUserSockets', () => {
        it('should return empty Set if user has no connections', () => {
            const sockets = service.getUserSockets('user-offline');
            expect(sockets.size).toBe(0);
        });

        it('should return all active socketIds for a user', () => {
            service.addConnection('user-1', 'socket-1');
            service.addConnection('user-1', 'socket-2');

            const sockets = service.getUserSockets('user-1');
            expect(sockets.has('socket-1')).toBe(true);
            expect(sockets.has('socket-2')).toBe(true);
            expect(sockets.size).toBe(2);
        });
    });
});
