import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Message } from "./entities/message.entity.js";
import { ChatService } from "./chat.service.js";
import { ChatController } from "./chat.controller.js";

@Module({
    imports: [TypeOrmModule.forFeature([Message])],
    controllers: [ChatController],
    providers: [ChatService],
    exports: [
        TypeOrmModule,
        ChatService,
    ],
})
export class ChatModule { }