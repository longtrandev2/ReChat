import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RoomMember } from "./entities/room-member.entity.js";
import { Room } from "./entities/room.entity.js";



@Module(
    {
        imports: [TypeOrmModule.forFeature([Room, RoomMember])],
        controllers: [],
        providers: [],
        exports: [
            TypeOrmModule
        ]
    }
)
export class RoomsModule { }