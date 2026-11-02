import { describe, it, expect } from 'vitest';
import { buildDirectKey, isDuplicateKeyError } from './direct-conversation-key.js';

describe('direct-conversation-key', () => {
    it('buildDirectKey is order independent', () => {
        expect(buildDirectKey('b', 'a')).toBe('a:b');
        expect(buildDirectKey('a', 'b')).toBe('a:b');
    });

    it('isDuplicateKeyError detects raw and TypeORM-wrapped MySQL duplicate errors', () => {
        expect(isDuplicateKeyError({ code: 'ER_DUP_ENTRY' })).toBe(true);
        expect(isDuplicateKeyError({ driverError: { errno: 1062 } })).toBe(true);
        expect(isDuplicateKeyError(new Error('other'))).toBe(false);
        expect(isDuplicateKeyError(null)).toBe(false);
    });
});
