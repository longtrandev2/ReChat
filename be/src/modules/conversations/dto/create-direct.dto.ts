import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateDirectDto {
    @ApiProperty({
        description: 'UUID của người bạn muốn tạo hoặc mở cuộc trò chuyện 1-1',
        example: '550e8400-e29b-41d4-a716-446655440000',
    })
    @IsNotEmpty({ message: 'targetUserId không được để trống' })
    @IsUUID('4', { message: 'targetUserId phải là định dạng UUID hợp lệ' })
    targetUserId: string;
}
