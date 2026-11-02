import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class Disable2faDto {
    @ApiProperty({
        description: 'Mật khẩu hiện tại để xác nhận tắt tính năng 2FA',
        example: 'Password123@',
    })
    @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống' })
    @IsString({ message: 'Mật khẩu phải là chuỗi' })
    password: string;
}
