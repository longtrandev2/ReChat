import {
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { FriendsService } from './friends.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

@ApiTags('friends')
@ApiBearerAuth('JWT-auth')
@Controller('friends')
@UseGuards(AuthGuard('jwt'))
export class FriendsController {
    constructor(private readonly friendsService: FriendsService) { }

    /**
     * Gửi lời mời kết bạn tới một người dùng (FR-05, BR-01)
     * POST /api/v1/friends/request/:userId
     */
    @Post('request/:userId')
    @ApiOperation({ summary: 'Gửi lời mời kết bạn (FR-05, BR-01)' })
    @ApiParam({ name: 'userId', description: 'UUID của người dùng muốn gửi lời mời', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440002' })
    @ApiResponse({
        status: 201,
        description: 'Gửi lời mời kết bạn thành công',
        schema: {
            example: {
                id: 'request-uuid',
                status: 'PENDING',
                requester: { id: '550e8400-e29b-41d4-a716-446655440001' },
                addressee: { id: '550e8400-e29b-41d4-a716-446655440002' },
                createdAt: '2026-10-14T10:00:00.000Z',
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Không thể tự gửi kết bạn cho chính mình',
        schema: {
            example: { statusCode: 400, message: 'Không thể tự kết bạn với chính mình', error: 'Bad Request' },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Người dùng không tồn tại',
        schema: {
            example: { statusCode: 404, message: 'Người dùng không tồn tại', error: 'Not Found' },
        },
    })
    @ApiResponse({
        status: 409,
        description: 'Đã gửi lời mời trước đó hoặc đã là bạn bè',
        schema: {
            example: { statusCode: 409, message: 'Lời mời kết bạn đã tồn tại hoặc hai người đã là bạn bè', error: 'Conflict' },
        },
    })
    async sendFriendRequest(
        @CurrentUser() user: User,
        @Param('userId', ParseUUIDPipe) targetUserId: string,
    ) {
        return this.friendsService.sendFriendRequest(user.id, targetUserId);
    }

    /**
     * Lấy danh sách lời mời kết bạn gửi đến tôi (Received pending) (FR-06)
     * GET /api/v1/friends/requests
     */
    @Get('requests')
    @ApiOperation({ summary: 'Lấy danh sách lời mời kết bạn nhận được (Received pending) (FR-06)' })
    @ApiResponse({
        status: 200,
        description: 'Danh sách lời mời kết bạn nhận được',
        schema: {
            example: [
                {
                    id: 'request-uuid',
                    status: 'PENDING',
                    createdAt: '2026-10-14T09:30:00.000Z',
                    requester: {
                        id: '550e8400-e29b-41d4-a716-446655440002',
                        username: 'nguyenvana',
                        displayName: 'Nguyễn Văn A',
                        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nva',
                    },
                },
            ],
        },
    })
    async getReceivedRequests(@CurrentUser() user: User) {
        return this.friendsService.getReceivedRequests(user.id);
    }

    /**
     * Lấy danh sách lời mời kết bạn tôi đã gửi (Sent pending) (FR-06)
     * GET /api/v1/friends/requests/sent
     */
    @Get('requests/sent')
    @ApiOperation({ summary: 'Lấy danh sách lời mời kết bạn tôi đã gửi (Sent pending) (FR-06)' })
    @ApiResponse({
        status: 200,
        description: 'Danh sách lời mời kết bạn đã gửi đang chờ chấp nhận',
        schema: {
            example: [
                {
                    id: 'request-uuid-2',
                    status: 'PENDING',
                    createdAt: '2026-10-14T09:40:00.000Z',
                    addressee: {
                        id: '550e8400-e29b-41d4-a716-446655440003',
                        username: 'tranthib',
                        displayName: 'Trần Thị B',
                        avatarUrl: null,
                    },
                },
            ],
        },
    })
    async getSentRequests(@CurrentUser() user: User) {
        return this.friendsService.getSentRequests(user.id);
    }

    /**
     * Chấp nhận lời mời kết bạn (FR-07, BR-02)
     * PATCH /api/v1/friends/requests/:requestId/accept
     */
    @Patch('requests/:requestId/accept')
    @ApiOperation({ summary: 'Chấp nhận lời mời kết bạn (FR-07, BR-02)' })
    @ApiParam({ name: 'requestId', description: 'UUID của lời mời kết bạn', format: 'uuid', example: 'request-uuid' })
    @ApiResponse({
        status: 200,
        description: 'Chấp nhận lời mời thành công, chuyển trạng thái sang ACCEPTED',
        schema: {
            example: {
                id: 'request-uuid',
                status: 'ACCEPTED',
                updatedAt: '2026-10-14T10:05:00.000Z',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Chỉ người nhận mới có quyền chấp nhận lời mời',
        schema: {
            example: { statusCode: 403, message: 'Bạn không có quyền chấp nhận lời mời này', error: 'Forbidden' },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Lời mời kết bạn không tồn tại',
        schema: {
            example: { statusCode: 404, message: 'Lời mời kết bạn không tồn tại', error: 'Not Found' },
        },
    })
    async acceptFriendRequest(
        @CurrentUser() user: User,
        @Param('requestId', ParseUUIDPipe) requestId: string,
    ) {
        return this.friendsService.acceptFriendRequest(user.id, requestId);
    }

    /**
     * Từ chối lời mời kết bạn (FR-07, BR-03)
     * DELETE /api/v1/friends/requests/:requestId/reject
     */
    @Delete('requests/:requestId/reject')
    @ApiOperation({ summary: 'Từ chối lời mời kết bạn (FR-07, BR-03)' })
    @ApiParam({ name: 'requestId', description: 'UUID của lời mời kết bạn', format: 'uuid', example: 'request-uuid' })
    @ApiResponse({
        status: 200,
        description: 'Từ chối lời mời kết bạn thành công',
        schema: {
            example: { message: 'Đã từ chối lời mời kết bạn' },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Chỉ người nhận mới có quyền từ chối',
        schema: {
            example: { statusCode: 403, message: 'Bạn không có quyền từ chối lời mời này', error: 'Forbidden' },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Lời mời kết bạn không tồn tại',
        schema: {
            example: { statusCode: 404, message: 'Lời mời kết bạn không tồn tại', error: 'Not Found' },
        },
    })
    async rejectFriendRequest(
        @CurrentUser() user: User,
        @Param('requestId', ParseUUIDPipe) requestId: string,
    ) {
        return this.friendsService.rejectFriendRequest(user.id, requestId);
    }

    /**
     * Thu hồi / Hủy lời mời kết bạn đã gửi (FR-07, BR-03)
     * DELETE /api/v1/friends/requests/:requestId/cancel
     */
    @Delete('requests/:requestId/cancel')
    @ApiOperation({ summary: 'Hủy lời mời kết bạn đã gửi (FR-07, BR-03)' })
    @ApiParam({ name: 'requestId', description: 'UUID của lời mời kết bạn', format: 'uuid', example: 'request-uuid-2' })
    @ApiResponse({
        status: 200,
        description: 'Hủy lời mời kết bạn thành công',
        schema: {
            example: { message: 'Đã hủy lời mời kết bạn thành công' },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Chỉ người gửi mới có quyền hủy lời mời này',
        schema: {
            example: { statusCode: 403, message: 'Bạn không có quyền hủy lời mời này', error: 'Forbidden' },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Lời mời không tồn tại',
        schema: {
            example: { statusCode: 404, message: 'Lời mời kết bạn không tồn tại', error: 'Not Found' },
        },
    })
    async cancelFriendRequest(
        @CurrentUser() user: User,
        @Param('requestId', ParseUUIDPipe) requestId: string,
    ) {
        return this.friendsService.cancelFriendRequest(user.id, requestId);
    }

    /**
     * Lấy danh sách bạn bè (kèm phân trang) (FR-08)
     * GET /api/v1/friends
     */
    @Get()
    @ApiOperation({ summary: 'Lấy danh sách bạn bè kèm phân trang (FR-08)' })
    @ApiResponse({
        status: 200,
        description: 'Danh sách bạn bè kèm metadata phân trang',
        schema: {
            example: {
                data: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440002',
                        username: 'nguyenvana',
                        displayName: 'Nguyễn Văn A',
                        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nva',
                        friendSince: '2026-10-14T10:05:00.000Z',
                    },
                ],
                meta: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPrevPage: false,
                },
            },
        },
    })
    async getFriendList(
        @CurrentUser() user: User,
        @Query() query: PaginationQueryDto,
    ) {
        return this.friendsService.getFriendList(user.id, query);
    }

    /**
     * Hủy kết bạn (Unfriend) (FR-08, BR-04)
     * DELETE /api/v1/friends/:friendId
     */
    @Delete(':friendId')
    @ApiOperation({ summary: 'Hủy kết bạn (Unfriend) (FR-08, BR-04)' })
    @ApiParam({ name: 'friendId', description: 'UUID của người bạn muốn hủy kết bạn', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440002' })
    @ApiResponse({
        status: 200,
        description: 'Hủy kết bạn thành công',
        schema: {
            example: { message: 'Đã hủy kết bạn thành công' },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Không tìm thấy quan hệ bạn bè giữa hai người',
        schema: {
            example: { statusCode: 404, message: 'Hai người hiện không phải là bạn bè', error: 'Not Found' },
        },
    })
    async unfriend(
        @CurrentUser() user: User,
        @Param('friendId', ParseUUIDPipe) friendId: string,
    ) {
        return this.friendsService.unfriend(user.id, friendId);
    }
}

