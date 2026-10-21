import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class SearchUsersDto {
    @ApiProperty({
        description: 'Từ khóa tìm kiếm (username hoặc displayName)',
        example: 'alex',
    })
    @IsNotEmpty({ message: 'Từ khóa tìm kiếm không được để trống' })
    @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi' })
    @MinLength(1, { message: 'Từ khóa tìm kiếm phải có ít nhất 1 ký tự' })
    q: string;

    @ApiPropertyOptional({
        description: 'Số lượng kết quả tối đa (1 - 50, mặc định 20)',
        example: 20,
        default: 20,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'Limit phải là số nguyên' })
    @Min(1, { message: 'Limit tối thiểu là 1' })
    @Max(50, { message: 'Limit tối đa là 50' })
    limit?: number = 20;
}
