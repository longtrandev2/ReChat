import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
    @ApiPropertyOptional({
        description: 'Số thứ tự trang (bắt đầu từ 1)',
        example: 1,
        default: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'page phải là số nguyên' })
    @Min(1, { message: 'page tối thiểu là 1' })
    page: number = 1;

    @ApiPropertyOptional({
        description: 'Số lượng phần tử trên mỗi trang (1 - 50)',
        example: 20,
        default: 20,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'limit phải là số nguyên' })
    @Min(1, { message: 'limit tối thiểu là 1' })
    @Max(50, { message: 'limit tối đa là 50' })
    limit: number = 20;
}

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
}
