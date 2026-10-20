import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class EditMessageDto {
    @IsOptional()
    @IsUUID(4, { message: 'conversationId phải là UUID hợp lệ' })
    conversationId?: string;

    @IsOptional()
    @IsUUID(4, { message: 'messageId phải là UUID hợp lệ' })
    messageId?: string;

    @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống' })
    @IsString({ message: 'Nội dung tin nhắn phải là chuỗi ký tự' })
    @MaxLength(2000, { message: 'Nội dung tin nhắn không được vượt quá 2000 ký tự' })
    content: string;
}
