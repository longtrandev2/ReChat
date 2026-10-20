import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import * as path from 'path';
import { MessageType } from '../conversations/entities/message.entity.js';
import { OnEvent } from '@nestjs/event-emitter';
import { MessageRecalledEvent } from '../../common/events/index.js';

export interface UploadedMediaResponse {
    url: string;
    publicId: string;
    originalName: string;
    mimeType: string;
    size: number;
    type: MessageType;
}

@Injectable()
export class MediaService {
    private readonly logger = new Logger(MediaService.name);

    private readonly BLACKLIST_EXTENSIONS = [
        '.exe',
        '.bat',
        '.cmd',
        '.sh',
        '.php',
        '.js',
        '.mjs',
        '.py',
        '.dll',
        '.bin',
        '.msi',
        '.vbs',
    ];

    private readonly ALLOWED_IMAGE_MIMES = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
    ];

    private readonly ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

    private readonly ALLOWED_FILE_EXTS = [
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.zip',
        '.rar',
        '.txt',
    ];

    private readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
    private readonly MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

    /**
     * Xác thực tệp tin, phân loại (IMAGE vs FILE), và tải trực tiếp lên Cloudinary
     */
    async uploadMedia(file: Express.Multer.File): Promise<UploadedMediaResponse> {
        if (!file || !file.buffer) {
            throw new BadRequestException('Không tìm thấy tệp tin tải lên');
        }

        const ext = path.extname(file.originalname).toLowerCase();

        // 1. Kiểm tra blacklist định dạng tệp nguy hiểm
        if (this.BLACKLIST_EXTENSIONS.includes(ext)) {
            throw new BadRequestException('Định dạng tệp tin bị cấm vì lý do bảo mật');
        }

        // 2. Phân loại và kiểm tra giới hạn dung lượng
        let mediaType: MessageType;
        let folder: string;
        let resourceType: 'image' | 'raw';

        const isImage =
            this.ALLOWED_IMAGE_MIMES.includes(file.mimetype) ||
            this.ALLOWED_IMAGE_EXTS.includes(ext);

        if (isImage) {
            if (file.size > this.MAX_IMAGE_SIZE) {
                throw new BadRequestException('Ảnh tải lên không được vượt quá 5MB');
            }
            mediaType = MessageType.IMAGE;
            folder = 'rechat/images';
            resourceType = 'image';
        } else {
            const isFile = this.ALLOWED_FILE_EXTS.includes(ext);
            if (!isFile) {
                throw new BadRequestException('Định dạng tệp tin không được hỗ trợ');
            }
            if (file.size > this.MAX_FILE_SIZE) {
                throw new BadRequestException('Tệp tin tải lên không được vượt quá 25MB');
            }
            mediaType = MessageType.FILE;
            folder = 'rechat/files';
            resourceType = 'raw';
        }

        // 3. Stream upload trực tiếp lên Cloudinary
        const uploadResult = await this.uploadToCloudinary(file.buffer, folder, resourceType);

        this.logger.log(`[Cloudinary] Tải lên thành công: ${uploadResult.public_id} (${mediaType})`);

        return {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            type: mediaType,
        };
    }

    /**
     * Helper stream upload buffer lên Cloudinary
     */
    uploadToCloudinary(
        buffer: Buffer,
        folder: string,
        resourceType: 'image' | 'raw',
    ): Promise<{ secure_url: string; public_id: string }> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: resourceType,
                    unique_filename: true,
                },
                (error, result) => {
                    if (error || !result) {
                        return reject(
                            new BadRequestException(
                                `Lỗi tải lên Cloudinary: ${error?.message || 'Không có phản hồi'}`,
                            ),
                        );
                    }
                    resolve({
                        secure_url: result.secure_url,
                        public_id: result.public_id,
                    });
                },
            );

            streamifier.createReadStream(buffer).pipe(uploadStream);
        });
    }

    /**
     * Xóa tài nguyên khỏi Cloudinary
     */
    async deleteFromCloudinary(publicId: string, resourceType: 'image' | 'raw' = 'image'): Promise<void> {
        try {
            await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
            this.logger.log(`[Cloudinary] Đã xóa tài nguyên: ${publicId}`);
        } catch (err: any) {
            this.logger.warn(`[Cloudinary] Không thể xóa publicId=${publicId}: ${err?.message}`);
        }
    }

    /**
     * Trích xuất publicId từ Cloudinary URL
     * URL pattern: https://res.cloudinary.com/<cloud>/<resource_type>/upload/v<version>/<folder>/<filename>.<ext>
     */
    extractPublicIdFromUrl(url: string): { publicId: string; resourceType: 'image' | 'raw' } | null {
        if (!url || !url.includes('res.cloudinary.com')) {
            return null;
        }

        try {
            const isImage = url.includes('/image/upload/');
            const resourceType: 'image' | 'raw' = isImage ? 'image' : 'raw';

            const parts = url.split('/upload/');
            if (parts.length < 2) return null;

            // Bỏ version v1234567/ nếu có
            let pathAfterUpload = parts[1];
            pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');

            // Nếu là image, bỏ đuôi mở rộng file (.jpg, .png, etc.)
            // Nếu là raw, Cloudinary giữ nguyên đuôi mở rộng trong publicId
            if (isImage) {
                const ext = path.extname(pathAfterUpload);
                if (ext) {
                    pathAfterUpload = pathAfterUpload.slice(0, -ext.length);
                }
            }

            return { publicId: pathAfterUpload, resourceType };
        } catch {
            return null;
        }
    }

    /**
     * Lắng nghe sự kiện thu hồi tin nhắn để dọn dẹp tài nguyên Cloudinary (BR-M5-03)
     */
    @OnEvent('message.recalled')
    async handleMessageRecalledCleanup(event: MessageRecalledEvent & { fileUrl?: string }) {
        if (!event.fileUrl) return;

        const extracted = this.extractPublicIdFromUrl(event.fileUrl);
        if (extracted) {
            this.logger.log(`[Tombstone] Thu hồi tin nhắn ${event.messageId}, đang xóa tài nguyên Cloudinary ${extracted.publicId}`);
            await this.deleteFromCloudinary(extracted.publicId, extracted.resourceType);
        }
    }
}
