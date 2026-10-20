import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadMediaDto {
    @ApiPropertyOptional({
        description: 'UUID của cuộc hội thoại nếu muốn tự động gửi tin nhắn ngay sau khi upload',
        format: 'uuid',
    })
    @IsOptional()
    @IsUUID(4, { message: 'conversationId phải là UUID hợp lệ' })
    conversationId?: string;
}
