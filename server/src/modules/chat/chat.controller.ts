import { Controller } from '@nestjs/common';
import { ChatService } from './chat.service.js';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) {}
}
