import { IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
    @IsString({ message: 'Tài khoản phải là chuỗi' })
    @IsNotEmpty({ message: 'Tài khoản không được phép để trống' })
    username: string;

    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @IsString({ message: 'Mật khẩu phải là chuỗi' })
    password: string;
}