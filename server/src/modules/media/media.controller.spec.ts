import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { ConversationsService } from '../conversations/conversations.service.js';
import { MessageType } from '../conversations/entities/message.entity.js';

describe('MediaController', () => {
    let controller: MediaController;
    let mockMediaService: {
        uploadMedia: ReturnType<typeof vi.fn>;
    };
    let mockConversationsService: {
        createMessage: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
        mockMediaService = {
            uploadMedia: vi.fn(),
        };

        mockConversationsService = {
            createMessage: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [MediaController],
            providers: [
                {
                    provide: MediaService,
                    useValue: mockMediaService,
                },
                {
                    provide: ConversationsService,
                    useValue: mockConversationsService,
                },
            ],
        }).compile();

        controller = module.get<MediaController>(MediaController);
    });

    it('nên được khởi tạo thành công', () => {
        expect(controller).toBeDefined();
    });

    describe('uploadMedia', () => {
        const mockFile = {
            originalname: 'avatar.png',
            mimetype: 'image/png',
            size: 50000,
            buffer: Buffer.from('test'),
        } as Express.Multer.File;

        const mockUploadedResult = {
            url: 'https://res.cloudinary.com/demo/image/upload/v1/avatar.png',
            publicId: 'rechat/images/uuid-1',
            originalName: 'avatar.png',
            mimeType: 'image/png',
            size: 50000,
            type: MessageType.IMAGE,
        };

        it('nên tải lên Cloudinary và trả về kết quả khi không truyền conversationId', async () => {
            mockMediaService.uploadMedia.mockResolvedValueOnce(mockUploadedResult);

            const result = await controller.uploadMedia('user-1', mockFile, {});

            expect(mockMediaService.uploadMedia).toHaveBeenCalledWith(mockFile);
            expect(mockConversationsService.createMessage).not.toHaveBeenCalled();
            expect(result).toEqual(mockUploadedResult);
        });

        it('nên tải lên Cloudinary và tự động tạo tin nhắn hội thoại khi truyền conversationId', async () => {
            mockMediaService.uploadMedia.mockResolvedValueOnce(mockUploadedResult);
            const mockCreatedMessage = {
                id: 'msg-media-1',
                conversationId: 'conv-123',
                content: 'avatar.png',
                type: MessageType.IMAGE,
                fileUrl: mockUploadedResult.url,
            };
            mockConversationsService.createMessage.mockResolvedValueOnce(mockCreatedMessage);

            const result = await controller.uploadMedia('user-1', mockFile, {
                conversationId: 'conv-123',
            });

            expect(mockMediaService.uploadMedia).toHaveBeenCalledWith(mockFile);
            expect(mockConversationsService.createMessage).toHaveBeenCalledWith(
                'user-1',
                {
                    conversationId: 'conv-123',
                    content: 'avatar.png',
                    type: MessageType.IMAGE,
                    fileUrl: mockUploadedResult.url,
                },
            );
            expect(result).toEqual({
                ...mockUploadedResult,
                message: mockCreatedMessage,
            });
        });
    });
});
