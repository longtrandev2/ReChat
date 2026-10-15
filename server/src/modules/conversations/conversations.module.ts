import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity.js';
import { ConversationMember } from './entities/conversation-member.entity.js';
import { Message } from './entities/message.entity.js';
import { ConversationsService } from './conversations.service.js';
import { ConversationsController } from './conversations.controller.js';
import { UsersModule } from '../users/user.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import { ConnectionManagerService } from './gateway/connection-manager.service.js';

import { User } from '../users/entities/user.entity.js';
import { Friendship } from '../friends/entities/friendship.entity.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Conversation,
            ConversationMember,
            Message,
            User,
            Friendship,
        ]),
        UsersModule,
        FriendsModule,
        AuthModule,
    ],
    controllers: [ConversationsController],
    providers: [ConversationsService, ConnectionManagerService, ChatGateway],
    exports: [ConversationsService, ConnectionManagerService, ChatGateway],
})
export class ConversationsModule { }

