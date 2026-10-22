import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
    @ApiPropertyOptional({
        description: 'Tên hiển thị người dùng (1 - 50 ký tự)',
        example: 'Nguyễn Văn A',
    })
    @IsOptional()
    @IsString({ message: 'Tên hiển thị phải là chuỗi' })
    @MinLength(1, { message: 'Tên hiển thị không được để rỗng' })
    @MaxLength(50, { message: 'Tên hiển thị tối đa 50 ký tự' })
    displayName?: string;

    @ApiPropertyOptional({
        description: 'Đường dẫn ảnh đại diện (URL)',
        example: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nva',
    })
    @IsOptional()
    @IsString({ message: 'Avatar URL phải là chuỗi' })
    @MaxLength(255, { message: 'Avatar URL tối đa 255 ký tự' })
    avatarUrl?: string;
}
