import { IsNotEmpty, IsUUID } from 'class-validator';

export class JoinConversationDto {
    @IsNotEmpty({ message: 'conversationId không được để trống' })
    @IsUUID(4, { message: 'conversationId phải là UUID hợp lệ' })
    conversationId: string;
}
