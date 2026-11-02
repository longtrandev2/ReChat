import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsEmoji } from '../../../common/validators/is-emoji.validator.js';

export class CustomizeConversationDto {
    @ApiPropertyOptional({ description: 'UUID của cuộc hội thoại' })
    @IsNotEmpty({ message: 'conversationId không được để trống' })
    @IsString({ message: 'conversationId phải là chuỗi ký tự' })
    conversationId: string;

    @ApiPropertyOptional({ description: 'Tên mới của đoạn chat (1-50 ký tự)' })
    @IsOptional()
    @IsString({ message: 'name phải là chuỗi ký tự' })
    @Length(1, 50, { message: 'Tên đoạn chat phải từ 1 đến 50 ký tự' })
    name?: string;

    @ApiPropertyOptional({ description: 'Ảnh đại diện mới của đoạn chat' })
    @IsOptional()
    @IsString({ message: 'avatarUrl phải là chuỗi ký tự' })
    @MaxLength(255, { message: 'avatarUrl không được vượt quá 255 ký tự' })
    avatarUrl?: string;

    @ApiPropertyOptional({ description: 'Quick Emoji mới (tối đa 32 ký tự)' })
    @IsOptional()
    @IsString({ message: 'quickEmoji phải là chuỗi ký tự' })
    @MaxLength(32, { message: 'quickEmoji không được vượt quá 32 ký tự' })
    @IsEmoji({ message: 'quickEmoji không hợp lệ (chỉ chấp nhận ký tự emoji)' })
    quickEmoji?: string;
}
