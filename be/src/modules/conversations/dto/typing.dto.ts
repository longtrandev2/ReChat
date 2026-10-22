import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';

export class TypingDto {
    @IsNotEmpty({ message: 'conversationId không được để trống' })
    @IsUUID(4, { message: 'conversationId phải là UUID hợp lệ' })
    conversationId: string;

    @IsBoolean({ message: 'isTyping phải là kiểu boolean' })
    isTyping: boolean;
}
