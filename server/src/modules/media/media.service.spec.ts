import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MediaService } from './media.service.js';
import { MessageType } from '../conversations/entities/message.entity.js';
import 'multer';

vi.mock('cloudinary', () => ({
    v2: {
        config: vi.fn(),
        uploader: {
            upload_stream: vi.fn(),
            destroy: vi.fn(),
        },
    },
}));

describe('MediaService', () => {
    let service: MediaService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new MediaService();
    });

    it('nên được khởi tạo thành công', () => {
        expect(service).toBeDefined();
    });

    describe('uploadMedia validation & classification', () => {
        it('nên ném lỗi BadRequestException nếu không có file hoặc buffer rỗng', async () => {
            await expect(service.uploadMedia(null as any)).rejects.toThrow(
                BadRequestException,
            );
            await expect(
                service.uploadMedia({ originalname: 'test.jpg' } as any),
            ).rejects.toThrow(BadRequestException);
        });

        it('nên ném lỗi BadRequestException nếu đuôi tệp nằm trong blacklist nguy hiểm (.exe, .sh, .php, etc.)', async () => {
            const maliciousFile = {
                originalname: 'virus.exe',
                mimetype: 'application/x-msdownload',
                buffer: Buffer.from('malicious content'),
                size: 100,
            } as Express.Multer.File;

            await expect(service.uploadMedia(maliciousFile)).rejects.toThrow(
                'Định dạng tệp tin bị cấm vì lý do bảo mật',
            );

            const scriptFile = {
                originalname: 'script.sh',
                mimetype: 'text/x-shellscript',
                buffer: Buffer.from('echo test'),
                size: 100,
            } as Express.Multer.File;

            await expect(service.uploadMedia(scriptFile)).rejects.toThrow(
                'Định dạng tệp tin bị cấm vì lý do bảo mật',
            );
        });

        it('nên ném lỗi BadRequestException nếu ảnh vượt quá 5MB', async () => {
            const largeImage = {
                originalname: 'large.png',
                mimetype: 'image/png',
                buffer: Buffer.alloc(6 * 1024 * 1024), // 6MB
                size: 6 * 1024 * 1024,
            } as Express.Multer.File;

            await expect(service.uploadMedia(largeImage)).rejects.toThrow(
                'Ảnh tải lên không được vượt quá 5MB',
            );
        });

        it('nên ném lỗi BadRequestException nếu tệp vượt quá 25MB', async () => {
            const largeFile = {
                originalname: 'document.pdf',
                mimetype: 'application/pdf',
                buffer: Buffer.alloc(26 * 1024 * 1024), // 26MB
                size: 26 * 1024 * 1024,
            } as Express.Multer.File;

            await expect(service.uploadMedia(largeFile)).rejects.toThrow(
                'Tệp tin tải lên không được vượt quá 25MB',
            );
        });

        it('nên ném lỗi BadRequestException nếu định dạng tệp không được hỗ trợ', async () => {
            const unsupportedFile = {
                originalname: 'unknown.xyz123',
                mimetype: 'application/octet-stream',
                buffer: Buffer.from('unknown'),
                size: 100,
            } as Express.Multer.File;

            await expect(service.uploadMedia(unsupportedFile)).rejects.toThrow(
                'Định dạng tệp tin không được hỗ trợ',
            );
        });

        it('nên phân loại và tải lên Cloudinary thành công đối với ảnh hợp lệ (IMAGE)', async () => {
            const validImage = {
                originalname: 'photo.jpg',
                mimetype: 'image/jpeg',
                buffer: Buffer.from('fake image binary'),
                size: 1024,
            } as Express.Multer.File;

            vi.spyOn(service, 'uploadToCloudinary').mockResolvedValueOnce({
                secure_url: 'https://res.cloudinary.com/demo/image/upload/v1234/rechat/images/uuid-123.jpg',
                public_id: 'rechat/images/uuid-123',
            });

            const result = await service.uploadMedia(validImage);

            expect(result.type).toBe(MessageType.IMAGE);
            expect(result.url).toBe(
                'https://res.cloudinary.com/demo/image/upload/v1234/rechat/images/uuid-123.jpg',
            );
            expect(result.publicId).toBe('rechat/images/uuid-123');
            expect(result.originalName).toBe('photo.jpg');
            expect(service.uploadToCloudinary).toHaveBeenCalledWith(
                validImage.buffer,
                'rechat/images',
                'image',
            );
        });

        it('nên phân loại và tải lên Cloudinary thành công đối với tệp tài liệu hợp lệ (FILE)', async () => {
            const validDoc = {
                originalname: 'report.pdf',
                mimetype: 'application/pdf',
                buffer: Buffer.from('fake pdf binary'),
                size: 2048,
            } as Express.Multer.File;

            vi.spyOn(service, 'uploadToCloudinary').mockResolvedValueOnce({
                secure_url: 'https://res.cloudinary.com/demo/raw/upload/v1234/rechat/files/report-123.pdf',
                public_id: 'rechat/files/report-123.pdf',
            });

            const result = await service.uploadMedia(validDoc);

            expect(result.type).toBe(MessageType.FILE);
            expect(result.url).toBe(
                'https://res.cloudinary.com/demo/raw/upload/v1234/rechat/files/report-123.pdf',
            );
            expect(result.publicId).toBe('rechat/files/report-123.pdf');
            expect(result.originalName).toBe('report.pdf');
            expect(service.uploadToCloudinary).toHaveBeenCalledWith(
                validDoc.buffer,
                'rechat/files',
                'raw',
            );
        });
    });

    describe('extractPublicIdFromUrl', () => {
        it('nên trích xuất publicId và resourceType chính xác từ link Cloudinary image', () => {
            const url =
                'https://res.cloudinary.com/cloud_name/image/upload/v1729432000/rechat/images/sample-pic.png';
            const extracted = service.extractPublicIdFromUrl(url);

            expect(extracted).toEqual({
                publicId: 'rechat/images/sample-pic',
                resourceType: 'image',
            });
        });

        it('nên trích xuất publicId và resourceType chính xác từ link Cloudinary raw file', () => {
            const url =
                'https://res.cloudinary.com/cloud_name/raw/upload/v1729432000/rechat/files/report.pdf';
            const extracted = service.extractPublicIdFromUrl(url);

            expect(extracted).toEqual({
                publicId: 'rechat/files/report.pdf',
                resourceType: 'raw',
            });
        });

        it('nên trả về null nếu URL không phải của Cloudinary', () => {
            expect(service.extractPublicIdFromUrl('https://example.com/pic.jpg')).toBeNull();
            expect(service.extractPublicIdFromUrl('')).toBeNull();
        });
    });

    describe('handleMessageRecalledCleanup (Tombstone File Cleanup)', () => {
        it('nên gọi deleteFromCloudinary khi tin nhắn thu hồi có fileUrl Cloudinary', async () => {
            const deleteSpy = vi.spyOn(service, 'deleteFromCloudinary').mockResolvedValueOnce();

            await service.handleMessageRecalledCleanup({
                conversationId: 'conv-1',
                messageId: 'msg-1',
                recalledAt: new Date(),
                senderId: 'user-1',
                fileUrl: 'https://res.cloudinary.com/demo/image/upload/v1/rechat/images/pic.png',
            });

            expect(deleteSpy).toHaveBeenCalledWith('rechat/images/pic', 'image');
        });

        it('nên bỏ qua nếu sự kiện tin nhắn thu hồi không có fileUrl', async () => {
            const deleteSpy = vi.spyOn(service, 'deleteFromCloudinary');

            await service.handleMessageRecalledCleanup({
                conversationId: 'conv-1',
                messageId: 'msg-1',
                recalledAt: new Date(),
                senderId: 'user-1',
                fileUrl: undefined,
            });

            expect(deleteSpy).not.toHaveBeenCalled();
        });
    });
});
