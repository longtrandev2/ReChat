import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MessageType } from '../entities/message.entity.js';

export class GetMessagesQueryDto {
    @ApiPropertyOptional({
        description: 'UUID của tin nhắn mốc để phân trang Cursor (lấy các tin nhắn trước tin này)',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsOptional()
    @IsUUID('4', { message: 'before cursor phải là định dạng UUID hợp lệ' })
    before?: string;

    @ApiPropertyOptional({
        description: 'Số lượng tin nhắn cần lấy (1 đến 50, mặc định 30)',
        example: 30,
        default: 30,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'limit phải là số nguyên' })
    @Min(1, { message: 'limit tối thiểu là 1' })
    @Max(50, { message: 'limit tối đa là 50' })
    limit?: number = 30;

    @ApiPropertyOptional({
        description: 'Lọc tin nhắn theo loại (TEXT, IMAGE, FILE)',
        enum: MessageType,
        example: MessageType.IMAGE,
    })
    @IsOptional()
    @IsEnum(MessageType, { message: 'type phải là TEXT, IMAGE hoặc FILE' })
    type?: MessageType;
}
