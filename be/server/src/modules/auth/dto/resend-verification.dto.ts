import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendVerificationDto {
    @ApiProperty({
        description: 'Email cần gửi lại mã xác thực OTP',
        example: 'nguyenvana@gmail.com',
    })
    @IsNotEmpty({ message: 'Email không được phép để trống' })
    @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
    email: string;
}
