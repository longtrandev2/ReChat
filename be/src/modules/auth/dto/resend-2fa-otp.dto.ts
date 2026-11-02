import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class Resend2faOtpDto {
    @ApiProperty({
        description: 'Mã token tạm thời do server cấp khi đăng nhập',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsNotEmpty({ message: 'mfaToken không được để trống' })
    @IsString({ message: 'mfaToken phải là chuỗi' })
    mfaToken: string;
}
