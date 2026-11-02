import { CookieOptions } from 'express';

/**
 * Tên cookie lưu trữ Refresh Token (HttpOnly)
 */
export const REFRESH_TOKEN_COOKIE_NAME = 'rechat_refresh_token';

/**
 * Thời hạn sống của Refresh Token (30 ngày)
 */
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60; // 2,592,000s

/**
 * Thời hạn sống của Access Token ngắn hạn trong bộ nhớ RAM (15 phút)
 */
export const ACCESS_TOKEN_TTL_MINUTES = 15;
export const ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_MINUTES * 60; // 900s

/**
 * Thời gian ân hạn Race Condition khi mở nhiều tab (Grace Period: 30 giây)
 */
export const REFRESH_TOKEN_GRACE_PERIOD_SECONDS = 30;

/**
 * Cấu hình Cookie Options chuẩn OWASP 2025 cho HttpOnly Refresh Token
 * - httpOnly: true => Chặn hoàn toàn mã độc XSS đọc token
 * - secure: true khi chạy production (chỉ truyền qua HTTPS)
 * - sameSite: 'lax' (hoặc 'strict' ở production) => Bảo vệ chống tấn công CSRF
 * - path: '/api/v1/auth' => Thu hẹp phạm vi gửi cookie chỉ đến các endpoint xác thực
 */
export const getRefreshTokenCookieOptions = (
    isProduction = process.env.NODE_ENV === 'production',
): CookieOptions => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/api/v1/auth',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
});

/**
 * Cấu hình Cookie Options để xóa sạch Refresh Token khi Logout
 */
export const getClearRefreshTokenCookieOptions = (
    isProduction = process.env.NODE_ENV === 'production',
): CookieOptions => ({
    ...getRefreshTokenCookieOptions(isProduction),
    maxAge: 0,
    expires: new Date(0),
});
