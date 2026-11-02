import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class TogglePinDto {
    @ApiProperty({
        description: 'Ghim (true) hoặc bỏ ghim (false) cuộc trò chuyện trong Inbox của riêng người dùng (FR-48)',
        example: true,
    })
    @IsBoolean({ message: 'isPinned phải là giá trị boolean' })
    isPinned: boolean;
}
