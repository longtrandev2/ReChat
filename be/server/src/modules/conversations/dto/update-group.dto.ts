import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateGroupDto {
    @ApiPropertyOptional({
        description: 'Tên mới của nhóm chat (1 - 50 ký tự)',
        example: 'Team Core Backend ReChat',
    })
    @IsOptional()
    @IsString({ message: 'Tên nhóm phải là chuỗi ký tự' })
    @Length(1, 50, { message: 'Tên nhóm phải có độ dài từ 1 đến 50 ký tự' })
    name?: string;

    @ApiPropertyOptional({
        description: 'Đường dẫn ảnh đại diện mới của nhóm chat (tối đa 255 ký tự)',
        example: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c',
    })
    @IsOptional()
    @IsString({ message: 'avatarUrl phải là chuỗi ký tự' })
    @MaxLength(255, { message: 'avatarUrl không được vượt quá 255 ký tự' })
    avatarUrl?: string;
}
