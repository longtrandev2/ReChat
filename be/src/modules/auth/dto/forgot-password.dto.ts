import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
    @ApiProperty({
        description: 'Email tài khoản cần đặt lại mật khẩu',
        example: 'nguyenvana@gmail.com',
    })
    @IsNotEmpty({ message: 'Email không được phép để trống' })
    @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
    email: string;
}
