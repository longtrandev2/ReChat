import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginDto {
    @IsString({ message: 'Tài khoản phải là chuỗi' })
    @IsNotEmpty({ message: 'Tài khoản không được phép để trống' })
    username: string;

    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @IsString({ message: 'Mật khẩu phải là chuỗi' })
    @MinLength(6, { message: "Mật khẩu phải từ 6 ký tự trở lên" })
    password: string;
}