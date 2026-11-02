import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
    @ApiProperty({
        description: 'Tài khoản đăng nhập (3 - 20 ký tự, chỉ gồm chữ, số, gạch dưới)',
        example: 'nguyenvana',
    })
    @IsNotEmpty({ message: 'Username không được phép để trống' })
    @IsString({ message: 'Username phải là chuỗi' })
    @MinLength(3, { message: 'Username phải từ 3 kí tự trở lên' })
    @MaxLength(20, { message: 'Username tối đa 20 kí tự' })
    @Matches(/^[a-zA-Z0-9_]+$/, {
        message: "Tài khoản chỉ được chứa chữ cái, chữ số và dấu gạch dưới (_)",
    })
    username: string;

    @ApiProperty({
        description: 'Địa chỉ Email người dùng',
        example: 'nguyenvana@gmail.com',
    })
    @IsNotEmpty({ message: 'Email không được phép để trống' })
    @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
    @MaxLength(100, { message: 'Email tối đa 100 kí tự' })
    email: string;

    @ApiProperty({
        description: 'Mật khẩu (tối thiểu 6 ký tự)',
        example: 'Secret@123456',
    })
    @IsNotEmpty({ message: 'Mật khẩu không được phép để trống' })
    @IsString({ message: 'Mật khẩu phải là chuỗi' })
    @MinLength(6, { message: 'Mật khẩu phải dài hơn 6 kí tự' })
    password: string;

    @ApiProperty({
        description: 'Xác nhận lại mật khẩu',
        example: 'Secret@123456',
    })
    @IsNotEmpty({ message: 'Mật khẩu xác nhận không được phép để trống' })
    @IsString({ message: 'Mật khẩu xác nhận phải là chuỗi' })
    confirmPassword: string;
}