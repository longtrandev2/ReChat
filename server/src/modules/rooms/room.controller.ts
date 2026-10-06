import { Controller } from '@nestjs/common';
import { RoomsService } from './room.service.js';

@Controller('rooms')
export class RoomsController {
    constructor(private readonly roomsService: RoomsService) {}
}
