import { describe, expect, it } from 'vitest';
import { isEmojiString } from './is-emoji.validator.js';

describe('isEmojiString (BR-29)', () => {
    it.each(['👍', '❤️', '🔥', '🎉', '🏸', '👨‍👩‍👧‍👦', '👍🏽', '🇻🇳', '1️⃣', '😀😀'])('accepts %s', (v) => {
        expect(isEmojiString(v)).toBe(true);
    });

    it.each(['', 'a', 'hello', '👍a', '<script>', '1', ' 👍', '👍 ', '‍', '️'])('rejects %j', (v) => {
        expect(isEmojiString(v)).toBe(false);
    });

    it('rejects non-string values', () => {
        expect(isEmojiString(123)).toBe(false);
        expect(isEmojiString(undefined)).toBe(false);
    });

    it('rejects strings longer than 32 chars', () => {
        expect(isEmojiString('😀'.repeat(17))).toBe(false); // 34 code units
        expect(isEmojiString('😀'.repeat(16))).toBe(true); // 32
    });
});
