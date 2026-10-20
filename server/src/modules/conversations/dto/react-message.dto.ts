import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReactMessageDto {
    @IsOptional()
    @IsUUID(4, { message: 'conversationId phải là UUID hợp lệ' })
    conversationId?: string;

    @IsOptional()
    @IsUUID(4, { message: 'messageId phải là UUID hợp lệ' })
    messageId?: string;

    @IsNotEmpty({ message: 'Emoji không được để trống' })
    @IsString({ message: 'Emoji phải là chuỗi ký tự' })
    @MaxLength(32, { message: 'Emoji không được vượt quá 32 ký tự' })
    emoji: string;
}
