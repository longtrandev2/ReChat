import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * BR-39: tối thiểu 8 ký tự, có ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.
 * Giới hạn 72 ký tự vì bcrypt bỏ qua phần vượt quá 72 byte.
 */
export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export class ChangePasswordDto {
    @ApiProperty({ description: 'Mật khẩu hiện tại của tài khoản', example: 'CurrentPass@123' })
    @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống' })
    @IsString({ message: 'Mật khẩu hiện tại phải là chuỗi' })
    currentPassword: string;

    @ApiProperty({
        description: 'Mật khẩu mới (8-72 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt)',
        example: 'NewPass@456',
    })
    @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
    @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
    @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
    @MaxLength(72, { message: 'Mật khẩu mới tối đa 72 ký tự' })
    @Matches(STRONG_PASSWORD_REGEX, {
        message: 'Mật khẩu mới phải chứa ít nhất một chữ hoa, một chữ thường, một chữ số và một ký tự đặc biệt',
    })
    newPassword: string;

    @ApiProperty({ description: 'Xác nhận lại mật khẩu mới', example: 'NewPass@456' })
    @IsNotEmpty({ message: 'Vui lòng xác nhận mật khẩu mới' })
    @IsString({ message: 'Mật khẩu xác nhận phải là chuỗi' })
    confirmPassword: string;
}
