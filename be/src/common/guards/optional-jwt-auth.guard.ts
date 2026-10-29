import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard xác thực JWT tùy chọn (Optional JWT Guard).
 * Nếu Token hợp lệ: gán req.user.
 * Nếu Token thiếu, hết hạn hoặc không hợp lệ: không quăng UnauthorizedException mà gán req.user = null.
 * Hữu ích cho các endpoint như /auth/logout để luôn cho phép xóa Cookie và thu hồi Refresh Token
 * ngay cả khi Access Token đã quá hạn 15 phút.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    override handleRequest<TUser = any>(err: any, user: any): TUser {
        if (err || !user) {
            return null as TUser;
        }
        return user;
    }
}
