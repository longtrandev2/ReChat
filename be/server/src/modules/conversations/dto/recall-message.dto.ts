import { IsNotEmpty, IsUUID } from 'class-validator';

export class RecallMessageDto {
    @IsNotEmpty({ message: 'conversationId không được để trống' })
    @IsUUID(4, { message: 'conversationId phải là UUID hợp lệ' })
    conversationId: string;

    @IsNotEmpty({ message: 'messageId không được để trống' })
    @IsUUID(4, { message: 'messageId phải là UUID hợp lệ' })
    messageId: string;
}
