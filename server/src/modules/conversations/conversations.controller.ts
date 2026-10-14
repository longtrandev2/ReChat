import {
    Body,
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
import { ConversationsService } from './conversations.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import {
    CreateDirectDto,
    CreateGroupDto,
    AddMembersDto,
    GetMessagesQueryDto,
} from './dto/index.js';

@ApiTags('conversations')
@ApiBearerAuth('JWT-auth')
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
        return this.conversationsService.addMembers(conversationId, user.id, dto);
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
        return this.conversationsService.leaveGroup(conversationId, user.id);
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
        return this.conversationsService.getMessages(conversationId, user.id, query);
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
        return this.conversationsService.markAsRead(conversationId, user.id);
    }
}

