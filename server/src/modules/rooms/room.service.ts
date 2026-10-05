import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity.js';
import { RoomMember } from './entities/room-member.entity.js';

@Injectable()
export class RoomsService {
    constructor(
        @InjectRepository(Room)
        private readonly roomRepository: Repository<Room>,
        @InjectRepository(RoomMember)
        private readonly roomMemberRepository: Repository<RoomMember>,
    ) {}
}
