import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { ChangePasswordDto } from '../dto/change-password.dto.js';

const build = (newPassword: string) => {
    const dto = new ChangePasswordDto();
    dto.currentPassword = 'Old@1234';
    dto.newPassword = newPassword;
    dto.confirmPassword = newPassword;
    return validate(dto);
};

describe('MaxUtf8BytesConstraint (ChangePasswordDto.newPassword)', () => {
    it('accepts an ASCII password of exactly 72 bytes', async () => {
        const pwd = 'Aa1!' + 'x'.repeat(68);
        expect(Buffer.byteLength(pwd)).toBe(72);
        expect(await build(pwd)).toHaveLength(0);
    });

    it('rejects a password under 72 characters but over 72 bytes', async () => {
        const pwd = 'Aa1!' + 'é'.repeat(40); // 44 ký tự, 84 byte
        expect(pwd.length).toBeLessThanOrEqual(72);
        const errors = await build(pwd);
        expect(errors.some((e) => e.constraints?.maxUtf8Bytes)).toBe(true);
    });
});
