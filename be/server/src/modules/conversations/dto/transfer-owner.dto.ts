import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class TransferOwnerDto {
    @ApiProperty({
        description: 'UUID của thành viên sẽ được chuyển giao quyền Trưởng nhóm (OWNER)',
        example: '550e8400-e29b-41d4-a716-446655440001',
    })
    @IsNotEmpty({ message: 'newOwnerId không được để trống' })
    @IsUUID('4', { message: 'newOwnerId phải là định dạng UUID hợp lệ' })
    newOwnerId: string;
}
