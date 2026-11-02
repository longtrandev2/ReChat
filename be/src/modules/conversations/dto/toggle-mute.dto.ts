import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleMuteDto {
    @ApiProperty({
        description: 'Trạng thái tắt/bật thông báo cuộc hội thoại (true = tắt tiếng, false = bật tiếng)',
        example: true,
    })
    @IsBoolean({ message: 'isMuted phải là giá trị boolean' })
    isMuted: boolean;
}
