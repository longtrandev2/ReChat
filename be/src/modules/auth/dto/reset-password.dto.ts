import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({
        description: 'Mã token đặt lại mật khẩu nhận được từ email',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsNotEmpty({ message: 'Token không được phép để trống' })
    @IsString({ message: 'Token phải là chuỗi' })
    token: string;

    @ApiProperty({
        description: 'Mật khẩu mới (tối thiểu 6 ký tự)',
        example: 'NewSecret@123',
    })
    @IsNotEmpty({ message: 'Mật khẩu mới không được phép để trống' })
    @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
    @MinLength(6, { message: 'Mật khẩu mới phải dài hơn 6 ký tự' })
    newPassword: string;

    @ApiProperty({
        description: 'Xác nhận lại mật khẩu mới',
        example: 'NewSecret@123',
    })
    @IsNotEmpty({ message: 'Mật khẩu xác nhận không được phép để trống' })
    @IsString({ message: 'Mật khẩu xác nhận phải là chuỗi' })
    confirmPassword: string;
}
