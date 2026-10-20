import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class Enable2faDto {
    @ApiProperty({
        description: 'Mã xác thực OTP 6 chữ số gửi về email',
        example: '123456',
    })
    @IsNotEmpty({ message: 'Mã OTP không được để trống' })
    @IsString({ message: 'Mã OTP phải là chuỗi' })
    @Length(6, 6, { message: 'Mã OTP phải có đúng 6 chữ số' })
    @Matches(/^\d{6}$/, { message: 'Mã OTP chỉ bao gồm các chữ số' })
    otp: string;
}
