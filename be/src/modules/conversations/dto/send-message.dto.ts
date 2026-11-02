import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import { MessageType } from '../entities/message.entity.js';

/** Loại tin nhắn client được phép gửi: SYSTEM chỉ do server tạo (BR-36) */
export const CLIENT_MESSAGE_TYPES = [MessageType.TEXT, MessageType.IMAGE, MessageType.FILE] as const;

export class SendMessageDto {
    @IsNotEmpty({ message: 'conversationId không được để trống' })
    @IsUUID(4, { message: 'conversationId phải là UUID hợp lệ' })
    conversationId: string;

    @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống' })
    @IsString({ message: 'Nội dung tin nhắn phải là chuỗi ký tự' })
    @MaxLength(2000, { message: 'Nội dung tin nhắn không được vượt quá 2000 ký tự' })
    content: string;

    @IsOptional()
    @IsIn(CLIENT_MESSAGE_TYPES, { message: 'Loại tin nhắn không hợp lệ (chỉ chấp nhận TEXT, IMAGE, FILE)' })
    type?: MessageType = MessageType.TEXT;

    @IsOptional()
    @IsString()
    @IsUrl(
        { protocols: ['http', 'https'], require_protocol: true, require_tld: false },
        { message: 'fileUrl phải là đường dẫn http(s) tuyệt đối hợp lệ' },
    )
    @MaxLength(500, { message: 'Đường dẫn file không vượt quá 500 ký tự' })
    fileUrl?: string;

    @IsOptional()
    @IsInt({ message: 'Dung lượng file phải là số nguyên' })
    fileSize?: number;

    @IsOptional()
    @IsUUID(4, { message: 'replyToId phải là UUID hợp lệ' })
    replyToId?: string;
}
