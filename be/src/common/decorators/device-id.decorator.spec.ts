import { describe, expect, it } from 'vitest';
import { extractDeviceId } from './device-id.decorator.js';
import type { Request } from 'express';

describe('extractDeviceId', () => {
    it('should prioritize X-Device-Id from headers when provided', () => {
        const mockReq = {
            headers: {
                'x-device-id': 'custom-uuid-device-123',
                'user-agent': 'Mozilla/5.0 Chrome/120.0',
            },
        } as unknown as Request;

        const result = extractDeviceId(mockReq);
        expect(result).toBe('custom-uuid-device-123');
    });

    it('should fallback to user-agent hash when X-Device-Id is missing or empty', () => {
        const mockReq = {
            headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            },
        } as unknown as Request;

        const result = extractDeviceId(mockReq);
        expect(result).toMatch(/^ua-[a-f0-9]{16}$/);
    });

    it('should fallback to default-device when both X-Device-Id and User-Agent are absent', () => {
        const mockReq = {
            headers: {},
        } as unknown as Request;

        const result = extractDeviceId(mockReq);
        expect(result).toBe('default-device');
    });

    it('should handle undefined request gracefully', () => {
        expect(extractDeviceId(undefined)).toBe('default-device');
    });
});
