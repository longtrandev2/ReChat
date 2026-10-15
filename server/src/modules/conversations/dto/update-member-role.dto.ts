import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ConversationRole } from '../entities/conversation-member.entity.js';

export class UpdateMemberRoleDto {
    @ApiProperty({
        description: 'Vai trò mới muốn gán cho thành viên (ADMIN hoặc MEMBER)',
        enum: [ConversationRole.ADMIN, ConversationRole.MEMBER],
        example: ConversationRole.ADMIN,
    })
    @IsNotEmpty({ message: 'Vai trò (role) không được để trống' })
    @IsEnum([ConversationRole.ADMIN, ConversationRole.MEMBER], {
        message: 'Vai trò phải là ADMIN hoặc MEMBER (không thể gán trực tiếp vai trò OWNER)',
    })
    role: ConversationRole;
}
