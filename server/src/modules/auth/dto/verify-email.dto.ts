import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
    @ApiProperty({
        description: 'Email cần xác thực',
        example: 'nguyenvana@gmail.com',
    })
    @IsNotEmpty({ message: 'Email không được phép để trống' })
    @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
    email: string;

    @ApiProperty({
        description: 'Mã xác thực OTP gồm 6 chữ số',
        example: '849201',
    })
    @IsNotEmpty({ message: 'Mã OTP không được phép để trống' })
    @IsString({ message: 'Mã OTP phải là chuỗi' })
    @Matches(/^\d{6}$/, { message: 'Mã OTP phải gồm chính xác 6 chữ số' })
    otp: string;
}
