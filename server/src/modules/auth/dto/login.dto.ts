import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
    @ApiProperty({
        description: 'Tài khoản đăng nhập',
        example: 'nguyenvana',
    })
    @IsString({ message: 'Tài khoản phải là chuỗi' })
    @IsNotEmpty({ message: 'Tài khoản không được phép để trống' })
    username: string;

    @ApiProperty({
        description: 'Mật khẩu',
        example: 'Secret@123456',
    })
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @IsString({ message: 'Mật khẩu phải là chuỗi' })
    password: string;
}