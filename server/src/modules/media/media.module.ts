import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaService } from './media.service.js';
import { MediaController } from './media.controller.js';
import { CloudinaryProvider } from './cloudinary.provider.js';
import { ConversationsModule } from '../conversations/conversations.module.js';

@Module({
    imports: [ConfigModule, ConversationsModule],
    controllers: [MediaController],
    providers: [CloudinaryProvider, MediaService],
    exports: [CloudinaryProvider, MediaService],
})
export class MediaModule { }
