import { randomInt } from 'node:crypto';

/**
 * Sinh mã OTP 6 chữ số bằng CSPRNG (crypto.randomInt) thay cho Math.random()
 * để mã không thể dự đoán được (OWASP: Insecure Randomness).
 */
export function generateOtp(): string {
    return randomInt(100000, 1000000).toString();
}
