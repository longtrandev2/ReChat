import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateQuickEmojiDto {
    @ApiProperty({
        description: 'Biểu tượng cảm xúc nhanh mới (ví dụ: 👍, ❤️, 🔥, 🎉, 🏸)',
        example: '❤️',
    })
    @IsNotEmpty({ message: 'Emoji không được để trống' })
    @IsString({ message: 'Emoji phải là chuỗi ký tự' })
    @MaxLength(32, { message: 'Emoji không được vượt quá 32 ký tự' })
    emoji: string;
}
