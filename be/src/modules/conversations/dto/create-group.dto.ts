import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';

export class CreateGroupDto {
    @ApiProperty({
        description: 'Tên nhóm chat (1 - 50 ký tự)',
        example: 'Nhóm Dự Án ReChat',
    })
    @IsNotEmpty({ message: 'Tên nhóm không được để trống' })
    @IsString({ message: 'Tên nhóm phải là chuỗi ký tự' })
    @Length(1, 50, { message: 'Tên nhóm phải có độ dài từ 1 đến 50 ký tự' })
    name: string;

    @ApiProperty({
        description: 'Danh sách UUID của các thành viên muốn thêm vào nhóm (tối thiểu 1)',
        example: ['550e8400-e29b-41d4-a716-446655440000'],
        type: [String],
    })
    @IsArray({ message: 'memberIds phải là một danh sách' })
    @ArrayMinSize(1, { message: 'Nhóm chat phải có ít nhất 1 thành viên khác' })
    @IsUUID('4', { each: true, message: 'Mỗi ID thành viên phải là định dạng UUID hợp lệ' })
    memberIds: string[];
}
