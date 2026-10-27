import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
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
import { ConversationsService } from './conversations.service.js';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import {
    CreateDirectDto,
    CreateGroupDto,
    AddMembersDto,
    GetMessagesQueryDto,
    TransferOwnerDto,
    UpdateMemberRoleDto,
    UpdateGroupDto,
    GetMediaQueryDto,
    EditMessageDto,
    ReactMessageDto,
} from './dto/index.js';

@ApiTags('conversations')
@ApiBearerAuth('JWT-auth')
@SkipThrottle({ auth: true })
@Controller('conversations')
@UseGuards(AuthGuard('jwt'))
export class ConversationsController {
    constructor(private readonly conversationsService: ConversationsService) { }

    /**
     * Lấy danh sách Inbox kèm lastMessage & unreadCount (FR-09, BR-10)
     * GET /api/v1/conversations
     */
    @Get()
    @ApiOperation({ summary: 'Lấy danh sách Inbox kèm tin nhắn gần nhất và số tin chưa đọc (FR-09, BR-10)' })
    @ApiResponse({
        status: 200,
        description: 'Lấy danh sách Inbox thành công (được sắp xếp theo tin nhắn mới nhất)',
        schema: {
            example: [
                {
                    id: 'e4b5a2e1-884d-4b71-a477-0c7f0db49211',
                    type: 'DIRECT',
                    name: 'Nguyễn Văn A',
                    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nva',
                    unreadCount: 2,
                    lastMessage: {
                        id: '7b89f0a2-b91c-4299-8089-a2e6b216f9f0',
                        content: 'Chào bạn, hôm nay có họp không?',
                        type: 'TEXT',
                        createdAt: '2026-10-14T10:00:00.000Z',
                        senderId: '550e8400-e29b-41d4-a716-446655440001',
                    },
                    createdAt: '2026-10-14T09:00:00.000Z',
                    updatedAt: '2026-10-14T10:00:00.000Z',
                },
                {
                    id: '81f0d361-9c12-4211-b0d5-768a31e138a2',
                    type: 'GROUP',
                    name: 'Team Dev ReChat',
                    avatarUrl: null,
                    unreadCount: 0,
                    lastMessage: {
                        id: '99e4b111-c111-4222-9333-e444b555f666',
                        content: 'Tôi vừa push code lên branch feat/conversations rồi nhé',
                        type: 'TEXT',
                        createdAt: '2026-10-14T09:45:00.000Z',
                        senderId: '550e8400-e29b-41d4-a716-446655440002',
                    },
                    createdAt: '2026-10-13T14:00:00.000Z',
                    updatedAt: '2026-10-14T09:45:00.000Z',
                },
            ],
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Chưa xác thực JWT Bearer token',
        schema: {
            example: {
                statusCode: 401,
                message: 'Unauthorized',
            },
        },
    })
    async getInbox(@CurrentUser() user: User) {
        return this.conversationsService.getInbox(user.id);
    }

    /**
     * Mở/tạo cuộc trò chuyện 1-1 với user { targetUserId } (FR-10, BR-05)
     * POST /api/v1/conversations/direct
     */
    @Post('direct')
    @ApiOperation({ summary: 'Mở/tạo cuộc trò chuyện 1-1 với bạn bè (FR-10, BR-05)' })
    @ApiResponse({
        status: 201,
        description: 'Tạo mới hoặc lấy cuộc trò chuyện 1-1 sẵn có thành công',
        schema: {
            example: {
                id: 'e4b5a2e1-884d-4b71-a477-0c7f0db49211',
                type: 'DIRECT',
                name: null,
                avatarUrl: null,
                lastMessageId: null,
                lastMessageAt: null,
                createdAt: '2026-10-14T10:00:00.000Z',
                updatedAt: '2026-10-14T10:00:00.000Z',
                members: [
                    {
                        id: 'member-1-uuid',
                        role: 'MEMBER',
                        unreadCount: 0,
                        lastReadMessageId: null,
                        joinedAt: '2026-10-14T10:00:00.000Z',
                        user: {
                            id: '550e8400-e29b-41d4-a716-446655440001',
                            username: 'current_user',
                            displayName: 'Current User',
                            avatarUrl: null,
                        },
                    },
                    {
                        id: 'member-2-uuid',
                        role: 'MEMBER',
                        unreadCount: 0,
                        lastReadMessageId: null,
                        joinedAt: '2026-10-14T10:00:00.000Z',
                        user: {
                            id: '550e8400-e29b-41d4-a716-446655440002',
                            username: 'target_user',
                            displayName: 'Target User',
                            avatarUrl: null,
                        },
                    },
                ],
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Không thể tự tạo cuộc hội thoại với chính mình hoặc UUID không hợp lệ',
        schema: {
            example: {
                statusCode: 400,
                message: 'Không thể tự tạo cuộc hội thoại với chính mình',
                error: 'Bad Request',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Chưa là bạn bè (chỉ được nhắn tin 1-1 với bạn bè đã ACCEPTED)',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn chỉ có thể nhắn tin với bạn bè đã kết bạn',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Người dùng mục tiêu không tồn tại trong hệ thống',
        schema: {
            example: {
                statusCode: 404,
                message: 'Người dùng không tồn tại',
                error: 'Not Found',
            },
        },
    })
    async createOrGetDirect(
        @CurrentUser() user: User,
        @Body() dto: CreateDirectDto,
    ) {
        return this.conversationsService.createOrGetDirect(user.id, dto.targetUserId);
    }

    /**
     * Tạo nhóm chat mới { name, memberIds } (FR-11, BR-06, BR-07)
     * POST /api/v1/conversations/group
     */
    @Post('group')
    @ApiOperation({ summary: 'Tạo nhóm chat mới (FR-11, BR-06, BR-07)' })
    @ApiResponse({
        status: 201,
        description: 'Tạo nhóm chat thành công (người tạo là OWNER, các thành viên khác là MEMBER)',
        schema: {
            example: {
                id: '81f0d361-9c12-4211-b0d5-768a31e138a2',
                type: 'GROUP',
                name: 'Team Dev ReChat',
                avatarUrl: null,
                lastMessageId: null,
                lastMessageAt: null,
                createdAt: '2026-10-14T10:00:00.000Z',
                updatedAt: '2026-10-14T10:00:00.000Z',
                members: [
                    {
                        id: 'm1-uuid',
                        role: 'OWNER',
                        unreadCount: 0,
                        joinedAt: '2026-10-14T10:00:00.000Z',
                        user: {
                            id: '550e8400-e29b-41d4-a716-446655440001',
                            username: 'owner_user',
                            displayName: 'Owner User',
                            avatarUrl: null,
                        },
                    },
                    {
                        id: 'm2-uuid',
                        role: 'MEMBER',
                        unreadCount: 0,
                        joinedAt: '2026-10-14T10:00:00.000Z',
                        user: {
                            id: '550e8400-e29b-41d4-a716-446655440002',
                            username: 'member_user',
                            displayName: 'Member User',
                            avatarUrl: null,
                        },
                    },
                ],
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Nhóm chat phải có tối thiểu 2 người (Người tạo + ít nhất 1 người khác)',
        schema: {
            example: {
                statusCode: 400,
                message: 'Nhóm chat phải có ít nhất 1 thành viên khác',
                error: 'Bad Request',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Có ID thành viên không tồn tại trong hệ thống',
        schema: {
            example: {
                statusCode: 404,
                message: 'Một hoặc nhiều người dùng được thêm không tồn tại',
                error: 'Not Found',
            },
        },
    })
    async createGroup(
        @CurrentUser() user: User,
        @Body() dto: CreateGroupDto,
    ) {
        return this.conversationsService.createGroup(user.id, dto);
    }

    /**
     * Thêm thành viên vào nhóm chat { memberIds } (FR-12, BR-08)
     * POST /api/v1/conversations/:id/members
     */
    @Post(':id/members')
    @ApiOperation({ summary: 'Thêm thành viên vào nhóm chat (FR-12, BR-08)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại nhóm', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiResponse({
        status: 201,
        description: 'Thêm thành viên vào nhóm thành công',
        schema: {
            example: {
                message: 'Thêm thành viên thành công',
                addedCount: 1,
                members: [
                    {
                        id: 'm3-uuid',
                        role: 'MEMBER',
                        unreadCount: 0,
                        joinedAt: '2026-10-14T10:05:00.000Z',
                        user: {
                            id: '550e8400-e29b-41d4-a716-446655440003',
                            username: 'new_member',
                            displayName: 'New Member',
                            avatarUrl: null,
                        },
                    },
                ],
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Hội thoại không phải nhóm (DIRECT không thể thêm thành viên)',
        schema: {
            example: {
                statusCode: 400,
                message: 'Chỉ có thể thêm thành viên vào cuộc hội thoại nhóm (GROUP)',
                error: 'Bad Request',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Người dùng không phải thành viên của nhóm này',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn không có quyền thêm thành viên vào nhóm này',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Cuộc hội thoại hoặc người dùng không tồn tại',
        schema: {
            example: {
                statusCode: 404,
                message: 'Cuộc hội thoại không tồn tại',
                error: 'Not Found',
            },
        },
    })
    @ApiResponse({
        status: 409,
        description: 'Tất cả người dùng gửi lên đều đã là thành viên của nhóm',
        schema: {
            example: {
                statusCode: 409,
                message: 'Tất cả người dùng này đã có trong nhóm chat',
                error: 'Conflict',
            },
        },
    })
    async addMembers(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Body() dto: AddMembersDto,
    ) {
        return this.conversationsService.addMembers(user.id, conversationId, dto);
    }

    /**
     * Rời khỏi nhóm chat (FR-12, BR-12)
     * DELETE /api/v1/conversations/:id/leave
     */
    @Delete(':id/leave')
    @ApiOperation({ summary: 'Rời khỏi nhóm chat (FR-12, BR-12)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại nhóm', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiResponse({
        status: 200,
        description: 'Rời nhóm thành công (Tự động chuyển Owner sang thành viên tham gia lâu nhất nếu Owner rời, hoặc giải tán nhóm nếu không còn ai)',
        schema: {
            example: {
                message: 'Rời nhóm thành công',
                transferredOwner: true,
                newOwnerId: '550e8400-e29b-41d4-a716-446655440003',
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Không thể rời cuộc trò chuyện 1-1',
        schema: {
            example: {
                statusCode: 400,
                message: 'Chỉ có thể rời khỏi cuộc hội thoại nhóm (GROUP)',
                error: 'Bad Request',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Người dùng không phải thành viên của nhóm',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn không phải là thành viên của cuộc hội thoại này',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Cuộc hội thoại không tồn tại',
        schema: {
            example: {
                statusCode: 404,
                message: 'Cuộc hội thoại không tồn tại',
                error: 'Not Found',
            },
        },
    })
    async leaveGroup(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
    ) {
        return this.conversationsService.leaveGroup(user.id, conversationId);
    }

    /**
     * Lấy lịch sử tin nhắn (hỗ trợ before={messageId}&limit=30) (FR-13, BR-08)
     * GET /api/v1/conversations/:id/messages
     */
    @Get(':id/messages')
    @ApiOperation({ summary: 'Lấy lịch sử tin nhắn (Cursor Pagination) (FR-13, BR-08)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại', format: 'uuid', example: 'e4b5a2e1-884d-4b71-a477-0c7f0db49211' })
    @ApiResponse({
        status: 200,
        description: 'Lấy lịch sử tin nhắn thành công (được sắp xếp theo thứ tự thời gian tăng dần)',
        schema: {
            example: [
                {
                    id: '7b89f0a2-b91c-4299-8089-a2e6b216f9f0',
                    content: 'Alo bạn ơi, dự án ReChat tiến độ thế nào rồi?',
                    type: 'TEXT',
                    fileUrl: null,
                    replyToId: null,
                    isRecalled: false,
                    createdAt: '2026-10-14T08:00:00.000Z',
                    updatedAt: '2026-10-14T08:00:00.000Z',
                    sender: {
                        id: '550e8400-e29b-41d4-a716-446655440001',
                        username: 'nguyenvana',
                        displayName: 'Nguyễn Văn A',
                        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nva',
                    },
                },
                {
                    id: '8c90a1b2-c02d-43aa-9190-b3f7c3270a01',
                    content: 'Mình vừa xong Milestone 3 rồi nhé!',
                    type: 'TEXT',
                    fileUrl: null,
                    replyToId: '7b89f0a2-b91c-4299-8089-a2e6b216f9f0',
                    isRecalled: false,
                    createdAt: '2026-10-14T08:01:00.000Z',
                    updatedAt: '2026-10-14T08:01:00.000Z',
                    sender: {
                        id: '550e8400-e29b-41d4-a716-446655440002',
                        username: 'tranthib',
                        displayName: 'Trần Thị B',
                        avatarUrl: null,
                    },
                },
            ],
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Người dùng không phải thành viên của cuộc hội thoại',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn không phải là thành viên của cuộc hội thoại này',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Cuộc hội thoại hoặc tin nhắn mốc cursor không tồn tại',
        schema: {
            example: {
                statusCode: 404,
                message: 'Tin nhắn mốc cursor không tồn tại trong cuộc hội thoại này',
                error: 'Not Found',
            },
        },
    })
    async getMessages(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Query() query: GetMessagesQueryDto,
    ) {
        return this.conversationsService.getMessages(user.id, conversationId, query);
    }

    /**
     * Đánh dấu đã đọc toàn bộ tin nhắn trong hội thoại (BR-10)
     * PATCH /api/v1/conversations/:id/read
     */
    @Patch(':id/read')
    @ApiOperation({ summary: 'Đánh dấu đã đọc toàn bộ tin nhắn trong hội thoại (BR-10)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại', format: 'uuid', example: 'e4b5a2e1-884d-4b71-a477-0c7f0db49211' })
    @ApiResponse({
        status: 200,
        description: 'Đánh dấu đã đọc thành công (reset unreadCount về 0)',
        schema: {
            example: {
                message: 'Đã đánh dấu đã đọc toàn bộ tin nhắn trong cuộc hội thoại',
                conversationId: 'e4b5a2e1-884d-4b71-a477-0c7f0db49211',
                unreadCount: 0,
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Người dùng không phải thành viên trong cuộc hội thoại',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn không phải là thành viên của cuộc hội thoại này',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Cuộc hội thoại không tồn tại',
        schema: {
            example: {
                statusCode: 404,
                message: 'Cuộc hội thoại không tồn tại',
                error: 'Not Found',
            },
        },
    })
    async markAsRead(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
    ) {
        return this.conversationsService.markAsRead(user.id, conversationId);
    }

    /**
     * Lấy chi tiết cuộc hội thoại và danh sách thành viên (FR-18, BR-08)
     * GET /api/v1/conversations/:id
     */
    @Get(':id')
    @ApiOperation({ summary: 'Lấy chi tiết cuộc hội thoại và danh sách thành viên (FR-18, BR-08)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiResponse({
        status: 200,
        description: 'Lấy chi tiết cuộc hội thoại thành công',
        schema: {
            example: {
                id: '81f0d361-9c12-4211-b0d5-768a31e138a2',
                type: 'GROUP',
                name: 'Team Dev ReChat',
                avatarUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=team',
                currentUserRole: 'OWNER',
                unreadCount: 0,
                members: [
                    {
                        id: '7b89f0a2-b91c-4299-8089-a2e6b216f9f0',
                        role: 'OWNER',
                        joinedAt: '2026-10-14T09:00:00.000Z',
                        user: {
                            id: '550e8400-e29b-41d4-a716-446655440001',
                            username: 'owner_user',
                            displayName: 'Nguyễn Văn Owner',
                            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=owner',
                            isOnline: true,
                            lastSeen: '2026-10-14T10:00:00.000Z',
                        },
                    },
                    {
                        id: '7b89f0a2-b91c-4299-8089-a2e6b216f9f1',
                        role: 'ADMIN',
                        joinedAt: '2026-10-14T09:05:00.000Z',
                        user: {
                            id: '550e8400-e29b-41d4-a716-446655440002',
                            username: 'member_user',
                            displayName: 'Trần Thị B',
                            avatarUrl: null,
                            isOnline: false,
                            lastSeen: '2026-10-14T09:30:00.000Z',
                        },
                    },
                ],
                createdAt: '2026-10-14T09:00:00.000Z',
                updatedAt: '2026-10-14T10:00:00.000Z',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Người dùng không phải thành viên của cuộc hội thoại',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn không phải thành viên của cuộc hội thoại này',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Cuộc hội thoại không tồn tại',
        schema: {
            example: {
                statusCode: 404,
                message: 'Cuộc hội thoại không tồn tại',
                error: 'Not Found',
            },
        },
    })
    async getConversationDetail(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
    ) {
        return this.conversationsService.getConversationDetail(user.id, conversationId);
    }

    /**
     * Cập nhật thông tin nhóm trò chuyện (tên, avatar) (FR-19, BR-17)
     * PATCH /api/v1/conversations/:id
     */
    @Patch(':id')
    @ApiOperation({ summary: 'Cập nhật thông tin nhóm trò chuyện (Tên nhóm, Avatar) (FR-19, BR-17)' })
    @ApiParam({ name: 'id', description: 'UUID của nhóm chat', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiResponse({
        status: 200,
        description: 'Cập nhật thông tin nhóm thành công',
        schema: {
            example: {
                id: '81f0d361-9c12-4211-b0d5-768a31e138a2',
                type: 'GROUP',
                name: 'Team Core Backend ReChat (Updated)',
                avatarUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c',
                createdAt: '2026-10-14T09:00:00.000Z',
                updatedAt: '2026-10-14T11:00:00.000Z',
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Không thể cập nhật cuộc trò chuyện 1-1 hoặc dữ liệu không hợp lệ',
        schema: {
            example: {
                statusCode: 400,
                message: 'Không thể cập nhật thông tin cuộc trò chuyện 1-1',
                error: 'Bad Request',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Người dùng không phải thành viên của nhóm chat',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn không phải thành viên của nhóm này',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Cuộc hội thoại không tồn tại',
        schema: {
            example: {
                statusCode: 404,
                message: 'Cuộc hội thoại không tồn tại',
                error: 'Not Found',
            },
        },
    })
    async updateGroup(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Body() dto: UpdateGroupDto,
    ) {
        return this.conversationsService.updateGroup(user.id, conversationId, dto);
    }

    /**
     * Xóa thành viên khỏi nhóm chat - Kick member (FR-18, BR-14)
     * DELETE /api/v1/conversations/:id/members/:userId
     */
    @Delete(':id/members/:userId')
    @ApiOperation({ summary: 'Xóa thành viên khỏi nhóm chat - Kick member (FR-18, BR-14)' })
    @ApiParam({ name: 'id', description: 'UUID của nhóm chat', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiParam({ name: 'userId', description: 'UUID của thành viên muốn xóa', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440003' })
    @ApiResponse({
        status: 200,
        description: 'Đã xóa thành viên khỏi nhóm chat thành công',
        schema: {
            example: {
                message: 'Đã xóa thành viên khỏi nhóm chat thành công',
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Không thể tự xóa chính mình hoặc cuộc trò chuyện không phải dạng nhóm',
        schema: {
            example: {
                statusCode: 400,
                message: 'Không thể tự xóa chính mình khỏi nhóm, hãy sử dụng tính năng rời nhóm',
                error: 'Bad Request',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Không đủ quyền hạn (Chỉ OWNER hoặc ADMIN, ADMIN không thể kick OWNER/ADMIN)',
        schema: {
            example: {
                statusCode: 403,
                message: 'Chỉ Trưởng nhóm hoặc Phó nhóm mới có quyền xóa thành viên',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Thành viên hoặc cuộc hội thoại không tồn tại',
        schema: {
            example: {
                statusCode: 404,
                message: 'Thành viên không tồn tại trong nhóm này',
                error: 'Not Found',
            },
        },
    })
    async kickMember(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Param('userId', ParseUUIDPipe) targetUserId: string,
    ) {
        return this.conversationsService.kickMember(user.id, conversationId, targetUserId);
    }

    /**
     * Chuyển giao quyền Trưởng nhóm (FR-18, BR-15)
     * PATCH /api/v1/conversations/:id/transfer-owner
     */
    @Patch(':id/transfer-owner')
    @ApiOperation({ summary: 'Chuyển giao quyền Trưởng nhóm cho thành viên khác (FR-18, BR-15)' })
    @ApiParam({ name: 'id', description: 'UUID của nhóm chat', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiResponse({
        status: 200,
        description: 'Chuyển giao quyền Trưởng nhóm thành công',
        schema: {
            example: {
                message: 'Chuyển giao quyền Trưởng nhóm thành công',
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Không thể chuyển quyền cho chính mình hoặc cuộc trò chuyện không phải dạng nhóm',
        schema: {
            example: {
                statusCode: 400,
                message: 'Bạn đã là Trưởng nhóm của cuộc trò chuyện này',
                error: 'Bad Request',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Chỉ Trưởng nhóm hiện tại mới có quyền chuyển giao',
        schema: {
            example: {
                statusCode: 403,
                message: 'Chỉ Trưởng nhóm mới có quyền chuyển giao quyền Trưởng nhóm',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Người dùng được chọn không phải là thành viên nhóm',
        schema: {
            example: {
                statusCode: 404,
                message: 'Người dùng được chọn không phải là thành viên của nhóm chat',
                error: 'Not Found',
            },
        },
    })
    async transferOwnership(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Body() dto: TransferOwnerDto,
    ) {
        return this.conversationsService.transferOwnership(user.id, conversationId, dto);
    }

    /**
     * Thay đổi vai trò thành viên - Thăng/Giáng cấp Admin (FR-18, BR-16)
     * PATCH /api/v1/conversations/:id/members/:userId/role
     */
    @Patch(':id/members/:userId/role')
    @ApiOperation({ summary: 'Thay đổi vai trò thành viên (Thăng/Giáng cấp Admin) (FR-18, BR-16)' })
    @ApiParam({ name: 'id', description: 'UUID của nhóm chat', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiParam({ name: 'userId', description: 'UUID của thành viên cần đổi vai trò', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440003' })
    @ApiResponse({
        status: 200,
        description: 'Cập nhật vai trò thành viên thành công',
        schema: {
            example: {
                message: 'Cập nhật vai trò thành viên thành công',
                member: {
                    id: '7b89f0a2-b91c-4299-8089-a2e6b216f9f2',
                    userId: '550e8400-e29b-41d4-a716-446655440003',
                    role: 'ADMIN',
                },
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Không thể tự thay đổi vai trò của chính mình hoặc role không hợp lệ',
        schema: {
            example: {
                statusCode: 400,
                message: 'Không thể tự thay đổi vai trò của chính mình',
                error: 'Bad Request',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Chỉ Trưởng nhóm (OWNER) mới có quyền thay đổi vai trò',
        schema: {
            example: {
                statusCode: 403,
                message: 'Chỉ Trưởng nhóm mới có quyền thay đổi vai trò của thành viên',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Thành viên không tồn tại trong nhóm chat',
        schema: {
            example: {
                statusCode: 404,
                message: 'Thành viên không tồn tại trong nhóm chat',
                error: 'Not Found',
            },
        },
    })
    async updateMemberRole(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Param('userId', ParseUUIDPipe) targetUserId: string,
        @Body() dto: UpdateMemberRoleDto,
    ) {
        return this.conversationsService.updateMemberRole(user.id, conversationId, targetUserId, dto);
    }

    /**
     * Ghim tin nhắn trong cuộc trò chuyện (FR-20, BR-18)
     * POST /api/v1/conversations/:id/messages/:messageId/pin
     */
    @Post(':id/messages/:messageId/pin')
    @ApiOperation({ summary: 'Ghim tin nhắn trong cuộc trò chuyện (FR-20, BR-18)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiParam({ name: 'messageId', description: 'UUID của tin nhắn muốn ghim', format: 'uuid', example: '99e4b111-c111-4222-9333-e444b555f666' })
    @ApiResponse({
        status: 200,
        description: 'Ghim tin nhắn thành công',
        schema: {
            example: {
                id: '99e4b111-c111-4222-9333-e444b555f666',
                content: 'Thông báo: Lịch họp dự án lúc 14h chiều nay',
                type: 'TEXT',
                isPinned: true,
                pinnedAt: '2026-10-14T11:00:00.000Z',
                createdAt: '2026-10-14T09:45:00.000Z',
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Không thể ghim tin nhắn đã bị thu hồi',
        schema: {
            example: {
                statusCode: 400,
                message: 'Không thể ghim tin nhắn đã bị thu hồi',
                error: 'Bad Request',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Người dùng không phải thành viên của cuộc hội thoại',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn không phải thành viên của cuộc hội thoại này',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Tin nhắn không tồn tại trong cuộc hội thoại',
        schema: {
            example: {
                statusCode: 404,
                message: 'Tin nhắn không tồn tại trong cuộc hội thoại này',
                error: 'Not Found',
            },
        },
    })
    async pinMessage(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Param('messageId', ParseUUIDPipe) messageId: string,
    ) {
        return this.conversationsService.pinMessage(user.id, conversationId, messageId);
    }

    /**
     * Bỏ ghim tin nhắn trong cuộc trò chuyện (FR-20, BR-18)
     * DELETE /api/v1/conversations/:id/messages/:messageId/pin
     */
    @Delete(':id/messages/:messageId/pin')
    @ApiOperation({ summary: 'Bỏ ghim tin nhắn trong cuộc trò chuyện (FR-20, BR-18)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiParam({ name: 'messageId', description: 'UUID của tin nhắn muốn bỏ ghim', format: 'uuid', example: '99e4b111-c111-4222-9333-e444b555f666' })
    @ApiResponse({
        status: 200,
        description: 'Bỏ ghim tin nhắn thành công',
        schema: {
            example: {
                message: 'Bỏ ghim tin nhắn thành công',
            },
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Tin nhắn chưa được ghim',
        schema: {
            example: {
                statusCode: 400,
                message: 'Tin nhắn này chưa được ghim',
                error: 'Bad Request',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Không có quyền bỏ ghim (Chỉ người ghim hoặc OWNER/ADMIN)',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn không có quyền bỏ ghim tin nhắn này',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Tin nhắn không tồn tại trong cuộc trò chuyện',
        schema: {
            example: {
                statusCode: 404,
                message: 'Tin nhắn không tồn tại trong cuộc hội thoại này',
                error: 'Not Found',
            },
        },
    })
    async unpinMessage(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Param('messageId', ParseUUIDPipe) messageId: string,
    ) {
        return this.conversationsService.unpinMessage(user.id, conversationId, messageId);
    }

    /**
     * Lấy danh sách tin nhắn đang ghim trong cuộc hội thoại (FR-20, BR-18)
     * GET /api/v1/conversations/:id/pinned-messages
     */
    @Get(':id/pinned-messages')
    @ApiOperation({ summary: 'Lấy danh sách tin nhắn đang ghim trong cuộc trò chuyện (FR-20, BR-18)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiResponse({
        status: 200,
        description: 'Lấy danh sách tin nhắn ghim thành công',
        schema: {
            example: [
                {
                    id: '99e4b111-c111-4222-9333-e444b555f666',
                    content: 'Thông báo: Lịch họp dự án lúc 14h chiều nay',
                    type: 'TEXT',
                    isPinned: true,
                    pinnedAt: '2026-10-14T11:00:00.000Z',
                    sender: {
                        id: '550e8400-e29b-41d4-a716-446655440001',
                        username: 'owner_user',
                        displayName: 'Nguyễn Văn Owner',
                        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=owner',
                    },
                    pinnedBy: {
                        id: '550e8400-e29b-41d4-a716-446655440001',
                        username: 'owner_user',
                        displayName: 'Nguyễn Văn Owner',
                    },
                    createdAt: '2026-10-14T09:45:00.000Z',
                },
            ],
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Người dùng không phải thành viên của cuộc hội thoại',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn không phải thành viên của cuộc hội thoại này',
                error: 'Forbidden',
            },
        },
    })
    async getPinnedMessages(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
    ) {
        return this.conversationsService.getPinnedMessages(user.id, conversationId);
    }

    /**
     * Kho ảnh và tệp tin phương tiện đã gửi (FR-21, BR-19)
     * GET /api/v1/conversations/:id/media
     */
    @Get(':id/media')
    @ApiOperation({ summary: 'Kho ảnh và tệp tin phương tiện đã gửi trong cuộc hội thoại (FR-21, BR-19)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiResponse({
        status: 200,
        description: 'Lấy danh sách tệp phương tiện thành công',
        schema: {
            example: [
                {
                    id: '99e4b111-c111-4222-9333-e444b555f777',
                    content: 'Thiết kế hệ thống ReChat.png',
                    type: 'IMAGE',
                    fileUrl: 'https://storage.rechat.vn/media/arch-diagram.png',
                    createdAt: '2026-10-14T10:15:00.000Z',
                    sender: {
                        id: '550e8400-e29b-41d4-a716-446655440002',
                        username: 'member_user',
                        displayName: 'Trần Thị B',
                        avatarUrl: null,
                    },
                },
            ],
        },
    })
    @ApiResponse({
        status: 400,
        description: 'Tin nhắn mốc cursor không tồn tại',
        schema: {
            example: {
                statusCode: 400,
                message: 'Tin nhắn mốc (before cursor) không tồn tại trong hội thoại này',
                error: 'Bad Request',
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Người dùng không phải thành viên của cuộc hội thoại',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn không phải thành viên của cuộc hội thoại này',
                error: 'Forbidden',
            },
        },
    })
    async getMediaMessages(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Query() query: GetMediaQueryDto,
    ) {
        return this.conversationsService.getMediaMessages(user.id, conversationId, query);
    }

    /**
     * Kiểm tra trạng thái hoạt động trực tuyến của cuộc hội thoại (FR-22, BR-20)
     * GET /api/v1/conversations/:id/active
     */
    @Get(':id/active')
    @ApiOperation({ summary: 'Kiểm tra trạng thái hoạt động trực tuyến của cuộc hội thoại (Active presence) (FR-22, BR-20)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại', format: 'uuid', example: '81f0d361-9c12-4211-b0d5-768a31e138a2' })
    @ApiResponse({
        status: 200,
        description: 'Lấy trạng thái active của cuộc trò chuyện thành công',
        schema: {
            example: {
                conversationId: '81f0d361-9c12-4211-b0d5-768a31e138a2',
                type: 'GROUP',
                isActive: true,
                activeMemberCount: 3,
                totalMemberCount: 5,
            },
        },
    })
    @ApiResponse({
        status: 403,
        description: 'Người dùng không phải thành viên của cuộc hội thoại',
        schema: {
            example: {
                statusCode: 403,
                message: 'Bạn không phải thành viên của cuộc hội thoại này',
                error: 'Forbidden',
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Cuộc hội thoại không tồn tại',
        schema: {
            example: {
                statusCode: 404,
                message: 'Cuộc hội thoại không tồn tại',
                error: 'Not Found',
            },
        },
    })
    async getConversationActiveStatus(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
    ) {
        return this.conversationsService.getConversationActiveStatus(user.id, conversationId);
    }

    /**
     * Thu hồi tin nhắn trong cuộc trò chuyện (Milestone 5, BR-M5-01 -> BR-M5-03)
     * PATCH /api/v1/conversations/:id/messages/:messageId/recall
     */
    @Patch(':id/messages/:messageId/recall')
    @ApiOperation({ summary: 'Thu hồi tin nhắn trong cuộc trò chuyện không giới hạn thời gian (Milestone 5)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại', format: 'uuid' })
    @ApiParam({ name: 'messageId', description: 'UUID của tin nhắn cần thu hồi', format: 'uuid' })
    @ApiResponse({
        status: 200,
        description: 'Thu hồi tin nhắn thành công',
    })
    @ApiResponse({
        status: 403,
        description: 'Người dùng không phải thành viên hoặc không phải chủ sở hữu tin nhắn',
    })
    @ApiResponse({
        status: 404,
        description: 'Không tìm thấy cuộc hội thoại hoặc tin nhắn',
    })
    async recallMessage(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Param('messageId', ParseUUIDPipe) messageId: string,
    ) {
        return this.conversationsService.recallMessage(user.id, conversationId, messageId);
    }

    /**
     * Chỉnh sửa nội dung tin nhắn văn bản (Milestone 5, BR-M5-04 -> BR-M5-07)
     * PATCH /api/v1/conversations/:id/messages/:messageId/edit
     */
    @Patch(':id/messages/:messageId/edit')
    @ApiOperation({ summary: 'Chỉnh sửa nội dung tin nhắn văn bản trong 15 phút (Milestone 5)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại', format: 'uuid' })
    @ApiParam({ name: 'messageId', description: 'UUID của tin nhắn cần chỉnh sửa', format: 'uuid' })
    @ApiResponse({
        status: 200,
        description: 'Chỉnh sửa tin nhắn thành công',
    })
    @ApiResponse({
        status: 400,
        description: 'Tin nhắn đã quá 15 phút, đã bị thu hồi hoặc nội dung không hợp lệ',
    })
    @ApiResponse({
        status: 403,
        description: 'Không phải chủ sở hữu tin nhắn',
    })
    @ApiResponse({
        status: 404,
        description: 'Không tìm thấy cuộc hội thoại hoặc tin nhắn',
    })
    async editMessage(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Param('messageId', ParseUUIDPipe) messageId: string,
        @Body() dto: EditMessageDto,
    ) {
        return this.conversationsService.editMessage(user.id, conversationId, messageId, dto.content);
    }

    /**
     * Thả hoặc hủy cảm xúc vào tin nhắn (Milestone 5, BR-M5-07, BR-M5-08)
     * POST /api/v1/conversations/:id/messages/:messageId/react
     */
    @Post(':id/messages/:messageId/react')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Thả hoặc hủy cảm xúc vào tin nhắn (Milestone 5)' })
    @ApiParam({ name: 'id', description: 'UUID của cuộc hội thoại', format: 'uuid' })
    @ApiParam({ name: 'messageId', description: 'UUID của tin nhắn cần thả cảm xúc', format: 'uuid' })
    @ApiResponse({
        status: 200,
        description: 'Thả hoặc hủy cảm xúc thành công',
    })
    @ApiResponse({
        status: 400,
        description: 'Tin nhắn đã bị thu hồi hoặc dữ liệu không hợp lệ',
    })
    @ApiResponse({
        status: 403,
        description: 'Không phải thành viên cuộc hội thoại',
    })
    @ApiResponse({
        status: 404,
        description: 'Không tìm thấy cuộc hội thoại hoặc tin nhắn',
    })
    async reactMessage(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) conversationId: string,
        @Param('messageId', ParseUUIDPipe) messageId: string,
        @Body() dto: ReactMessageDto,
    ) {
        return this.conversationsService.reactMessage(user.id, conversationId, messageId, dto.emoji);
    }
}



