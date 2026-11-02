import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class AddMembersDto {
    @ApiProperty({
        description: 'Danh sách UUID của các thành viên muốn thêm vào nhóm (tối thiểu 1)',
        example: ['550e8400-e29b-41d4-a716-446655440000'],
        type: [String],
    })
    @IsArray({ message: 'memberIds phải là một danh sách' })
    @ArrayMinSize(1, { message: 'Cần chọn ít nhất 1 thành viên để thêm vào nhóm' })
    @IsUUID('4', { each: true, message: 'Mỗi ID thành viên phải là định dạng UUID hợp lệ' })
    memberIds: string[];
}
