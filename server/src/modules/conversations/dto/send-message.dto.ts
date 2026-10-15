import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MessageType } from '../entities/message.entity.js';

export class SendMessageDto {
    @IsNotEmpty({ message: 'conversationId không được để trống' })
    @IsUUID(4, { message: 'conversationId phải là UUID hợp lệ' })
    conversationId: string;

    @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống' })
    @IsString({ message: 'Nội dung tin nhắn phải là chuỗi ký tự' })
    @MaxLength(2000, { message: 'Nội dung tin nhắn không được vượt quá 2000 ký tự' })
    content: string;

    @IsOptional()
    @IsEnum(MessageType, { message: 'Loại tin nhắn không hợp lệ (TEXT, IMAGE, FILE)' })
    type?: MessageType = MessageType.TEXT;

    @IsOptional()
    @IsString()
    @MaxLength(500, { message: 'Đường dẫn file không vượt quá 500 ký tự' })
    fileUrl?: string;

    @IsOptional()
    @IsUUID(4, { message: 'replyToId phải là UUID hợp lệ' })
    replyToId?: string;
}
