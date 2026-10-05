import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RoomMember } from "./entities/room-member.entity.js";
import { Room } from "./entities/room.entity.js";
import { RoomsService } from "./room.service.js";
import { RoomsController } from "./room.controller.js";

@Module({
    imports: [TypeOrmModule.forFeature([Room, RoomMember])],
    controllers: [RoomsController],
    providers: [RoomsService],
    exports: [
        TypeOrmModule,
        RoomsService,
    ],
})
export class RoomsModule { }