import { Controller } from '@nestjs/common';
import { UsersService } from './user.service.js';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}
}
