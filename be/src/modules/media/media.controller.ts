import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
    UseGuards,
    Body,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { MediaService, UploadedMediaResponse } from './media.service.js';
import { UploadMediaDto } from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ConversationsService } from '../conversations/conversations.service.js';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageCreatedEvent } from '../../common/events/index.js';

@ApiTags('media')
@ApiBearerAuth('JWT-auth')
@Controller('media')
@UseGuards(AuthGuard('jwt'))
export class MediaController {
    constructor(
        private readonly mediaService: MediaService,
        private readonly conversationsService: ConversationsService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Tải lên hình ảnh hoặc tệp tin lên Cloudinary (Milestone 5, Scope 4)
     * POST /api/v1/media/upload
     * - Nếu truyền conversationId: Tự động tạo tin nhắn và phát sóng (publish) realtime event vào phòng chat
     * - Nếu không truyền conversationId: Trả về URL để client sử dụng linh hoạt
     */
    @Post('upload')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(
        FileInterceptor('file', {
            limits: {
                fileSize: 25 * 1024 * 1024, // 25MB max
            },
        }),
    )
    @ApiOperation({
        summary: 'Tải lên hình ảnh hoặc tệp tin lên Cloudinary',
        description: 'Tải lên ảnh (max 5MB) hoặc tài liệu (max 25MB). Nếu cung cấp conversationId, hệ thống sẽ tự động phát sóng tin nhắn vào phòng chat.',
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['file'],
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Tệp tin hoặc hình ảnh cần tải lên',
                },
                conversationId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'UUID hội thoại (Tùy chọn: Tự động gửi tin nhắn nếu có)',
                },
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Tải lên thành công, trả về link Cloudinary và thông tin tệp tin',
    })
    @ApiResponse({
        status: 400,
        description: 'Định dạng tệp không hợp lệ, vượt quá dung lượng cho phép hoặc bị cấm',
    })
    @ApiResponse({
        status: 401,
        description: 'Chưa xác thực người dùng (Unauthorized)',
    })
    async uploadMedia(
        @CurrentUser('id') userId: string,
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: UploadMediaDto,
    ): Promise<UploadedMediaResponse & { message?: any }> {
        // 1. Tải lên Cloudinary qua MediaService
        const uploaded = await this.mediaService.uploadMedia(file);

        // 2. Nếu có conversationId, tự động tạo tin nhắn và trigger event realtime
        if (dto?.conversationId) {
            const message = await this.conversationsService.createMessage(userId, {
                conversationId: dto.conversationId,
                content: uploaded.originalName,
                type: uploaded.type,
                fileUrl: uploaded.url,
            });

            this.eventEmitter.emit(
                'message.created',
                new MessageCreatedEvent(dto.conversationId, {
                    id: message.id,
                    conversationId: dto.conversationId,
                    content: message.content,
                    type: message.type,
                    fileUrl: message.fileUrl,
                    replyToId: message.replyToId,
                    replyTo: null,
                    reactions: [],
                    isRecalled: message.isRecalled,
                    isEdited: message.isEdited,
                    editedAt: message.editedAt,
                    isPinned: message.isPinned,
                    createdAt: message.createdAt,
                    sender: {
                        id: message.sender?.id ?? userId,
                        username: message.sender?.username ?? '',
                        displayName: message.sender?.displayName ?? '',
                        avatarUrl: message.sender?.avatarUrl ?? null,
                    },
                }),
            );

            return {
                ...uploaded,
                message,
            };
        }

        return uploaded;
    }
}
