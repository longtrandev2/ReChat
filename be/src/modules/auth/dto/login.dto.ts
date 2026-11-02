import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
    @ApiProperty({
        description: 'Tài khoản đăng nhập (Username hoặc Email)',
        example: 'nguyenvana hoặc nguyenvana@gmail.com',
    })
    @IsString({ message: 'Tài khoản phải là chuỗi' })
    @IsNotEmpty({ message: 'Tài khoản hoặc email không được phép để trống' })
    username: string;

    @ApiProperty({
        description: 'Mật khẩu',
        example: 'Secret@123456',
    })
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @IsString({ message: 'Mật khẩu phải là chuỗi' })
    password: string;

    @ApiProperty({
        description: 'Định danh thiết bị đăng nhập (Device ID)',
        example: 'device-web-chrome-mac',
        required: false,
    })
    deviceId?: string;
}