import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class Verify2faLoginDto {
    @ApiProperty({
        description: 'Mã token tạm thời do server cấp sau khi kiểm tra đúng username/password',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsNotEmpty({ message: 'mfaToken không được để trống' })
    @IsString({ message: 'mfaToken phải là chuỗi' })
    mfaToken: string;

    @ApiProperty({
        description: 'Mã xác thực OTP 6 chữ số gửi về email đăng ký',
        example: '654321',
    })
    @IsNotEmpty({ message: 'Mã OTP không được để trống' })
    @IsString({ message: 'Mã OTP phải là chuỗi' })
    @Length(6, 6, { message: 'Mã OTP phải có đúng 6 chữ số' })
    @Matches(/^\d{6}$/, { message: 'Mã OTP chỉ bao gồm các chữ số' })
    otp: string;

    @ApiProperty({
        description: 'Định danh thiết bị (Device ID) cho quản lý đa thiết bị',
        example: 'device-web-chrome-mac',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'deviceId phải là chuỗi' })
    deviceId?: string;
}
