import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './user.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from './entities/user.entity.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { SearchUsersDto } from './dto/search-users.dto.js';

@ApiTags('users')
@Controller('users')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT-auth')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Patch('me')
    @ApiOperation({ summary: 'Cập nhật thông tin tài khoản cá nhân (FR-03)' })
    @ApiResponse({
        status: 200,
        description: 'Cập nhật thông tin thành công',
        schema: {
            example: {
                id: '550e8400-e29b-41d4-a716-446655440001',
                username: 'alex',
                displayName: 'Alex Nguyễn',
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
                isOnline: true,
                lastSeen: null,
                createdAt: '2026-10-14T10:00:00.000Z',
                updatedAt: '2026-10-20T10:00:00.000Z',
            },
        },
    })
    updateProfile(
        @CurrentUser() user: User,
        @Body() updateProfileDto: UpdateProfileDto,
    ) {
        return this.usersService.updateProfile(user.id, updateProfileDto);
    }

    @Get('search')
    @ApiOperation({ summary: 'Tìm kiếm người dùng theo username hoặc tên hiển thị (FR-04)' })
    @ApiResponse({
        status: 200,
        description: 'Danh sách người dùng tìm thấy',
        schema: {
            example: [
                {
                    id: '550e8400-e29b-41d4-a716-446655440002',
                    username: 'bob',
                    displayName: 'Bob Trần',
                    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
                    isOnline: false,
                    lastSeen: '2026-10-20T08:00:00.000Z',
                },
            ],
        },
    })
    searchUsers(
        @CurrentUser() user: User,
        @Query() searchUsersDto: SearchUsersDto,
    ) {
        return this.usersService.searchUsers(user.id, searchUsersDto.q, searchUsersDto.limit);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Lấy thông tin trang cá nhân công khai của người dùng' })
    @ApiResponse({
        status: 200,
        description: 'Thông tin công khai của người dùng',
        schema: {
            example: {
                id: '550e8400-e29b-41d4-a716-446655440002',
                username: 'bob',
                displayName: 'Bob Trần',
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
                isOnline: false,
                lastSeen: '2026-10-20T08:00:00.000Z',
                createdAt: '2026-10-14T10:00:00.000Z',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Người dùng không tồn tại',
    })
    getPublicProfile(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.getPublicProfile(id);
    }
}
