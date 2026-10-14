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
import { FriendsService } from './friends.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';

@Controller('friends')
@UseGuards(AuthGuard('jwt'))
export class FriendsController {
    constructor(private readonly friendsService: FriendsService) { }

    /**
     * Gửi lời mời kết bạn tới một người dùng
     * POST /api/v1/friends/request/:userId
     */
    @Post('request/:userId')
    async sendFriendRequest(
        @CurrentUser() user: User,
        @Param('userId', ParseUUIDPipe) targetUserId: string,
    ) {
        return this.friendsService.sendFriendRequest(user.id, targetUserId);
    }

    /**
     * Lấy danh sách lời mời kết bạn gửi đến tôi (Received pending)
     * GET /api/v1/friends/requests
     */
    @Get('requests')
    async getReceivedRequests(@CurrentUser() user: User) {
        return this.friendsService.getReceivedRequests(user.id);
    }

    /**
     * Lấy danh sách lời mời kết bạn tôi đã gửi (Sent pending)
     * GET /api/v1/friends/requests/sent
     */
    @Get('requests/sent')
    async getSentRequests(@CurrentUser() user: User) {
        return this.friendsService.getSentRequests(user.id);
    }

    /**
     * Chấp nhận lời mời kết bạn
     * PATCH /api/v1/friends/requests/:requestId/accept
     */
    @Patch('requests/:requestId/accept')
    async acceptFriendRequest(
        @CurrentUser() user: User,
        @Param('requestId', ParseUUIDPipe) requestId: string,
    ) {
        return this.friendsService.acceptFriendRequest(user.id, requestId);
    }

    /**
     * Từ chối lời mời kết bạn
     * DELETE /api/v1/friends/requests/:requestId/reject
     */
    @Delete('requests/:requestId/reject')
    async rejectFriendRequest(
        @CurrentUser() user: User,
        @Param('requestId', ParseUUIDPipe) requestId: string,
    ) {
        return this.friendsService.rejectFriendRequest(user.id, requestId);
    }

    /**
     * Thu hồi / Hủy lời mời kết bạn đã gửi
     * DELETE /api/v1/friends/requests/:requestId/cancel
     */
    @Delete('requests/:requestId/cancel')
    async cancelFriendRequest(
        @CurrentUser() user: User,
        @Param('requestId', ParseUUIDPipe) requestId: string,
    ) {
        return this.friendsService.cancelFriendRequest(user.id, requestId);
    }

    /**
     * Lấy danh sách bạn bè (kèm phân trang)
     * GET /api/v1/friends
     */
    @Get()
    async getFriendList(
        @CurrentUser() user: User,
        @Query() query: PaginationQueryDto,
    ) {
        return this.friendsService.getFriendList(user.id, query);
    }

    /**
     * Hủy kết bạn (Unfriend)
     * DELETE /api/v1/friends/:friendId
     * (Đặt cuối cùng để tránh nuốt các route /friends/requests/...)
     */
    @Delete(':friendId')
    async unfriend(
        @CurrentUser() user: User,
        @Param('friendId', ParseUUIDPipe) friendId: string,
    ) {
        return this.friendsService.unfriend(user.id, friendId);
    }
}
