import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";


export class RegisterDto {
    @IsNotEmpty({ message: 'Username không được phép để trống' })
    @IsString({ message: 'Username phải là chuỗi' })
    @MinLength(3, { message: 'Username phải từ 3 kí tự trở lên' })
    @MaxLength(20, { message: 'Username tối đa 20 kí tự' })
    @Matches(/^[a-zA-Z0-9_]+$/, {
        message: "Tài khoản chỉ được chứa chữ cái, chữ số và dấu gạch dưới (_)",
    })
    username: string;


    @IsNotEmpty({ message: 'Mật khẩu không được phép để trống' })
    @IsString({ message: 'Mật khẩu phải là chuỗi' })
    @MinLength(6, { message: 'Mật khẩu phải dài hơn 6 kí tự' })
    password: string;

    @IsNotEmpty({ message: 'Mật khẩu xác nhận không được phép để trống' })
    @IsString({ message: 'Mật khẩu xác nhận phải là chuỗi' })
    confirmPassword: string;
}