import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    async findById(id: string): Promise<Omit<User, 'password'>> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        const { password: _password, ...result } = user;
        return result;
    }

    async findByUsername(username: string): Promise<User | null> {
        return this.userRepository.findOne({ where: { username } });
    }

    async updateProfile(userId: string, dto: UpdateProfileDto): Promise<Omit<User, 'password'>> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        if (dto.displayName !== undefined) {
            user.displayName = dto.displayName.trim();
        }
        if (dto.avatarUrl !== undefined) {
            user.avatarUrl = dto.avatarUrl.trim();
        }

        const saved = await this.userRepository.save(user);
        const { password: _password, ...result } = saved;
        return result;
    }

    async searchUsers(currentUserId: string, q: string, limit = 20): Promise<Array<Omit<User, 'password'>>> {
        const keyword = `%${q.trim().toLowerCase()}%`;
        const users = await this.userRepository
            .createQueryBuilder('user')
            .where('user.id != :currentUserId', { currentUserId })
            .andWhere('(LOWER(user.username) LIKE :keyword OR LOWER(user.displayName) LIKE :keyword)', { keyword })
            .orderBy('user.username', 'ASC')
            .take(Math.min(limit, 50))
            .getMany();

        return users.map(({ password: _password, ...rest }) => rest);
    }

    async getPublicProfile(targetUserId: string): Promise<Omit<User, 'password'>> {
        return this.findById(targetUserId);
    }
}

