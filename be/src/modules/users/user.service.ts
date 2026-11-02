import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

/** Các trường công khai của hồ sơ người dùng khác (không email / 2FA / updatedAt / password) */
const PUBLIC_PROFILE_FIELDS = ['id', 'username', 'displayName', 'avatarUrl', 'isOnline', 'lastSeen', 'createdAt'] as const;
export type PublicUserProfile = Pick<User, (typeof PUBLIC_PROFILE_FIELDS)[number]>;

export const toPublicProfile = (user: User): PublicUserProfile => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isOnline: user.isOnline,
    lastSeen: user.lastSeen,
    createdAt: user.createdAt,
});

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

    async searchUsers(currentUserId: string, q: string, limit = 20): Promise<PublicUserProfile[]> {
        const keyword = `%${q.trim().toLowerCase()}%`;
        const users = await this.userRepository
            .createQueryBuilder('user')
            .select(PUBLIC_PROFILE_FIELDS.map((f) => `user.${f}`))
            .where('user.id != :currentUserId', { currentUserId })
            .andWhere('(LOWER(user.username) LIKE :keyword OR LOWER(user.displayName) LIKE :keyword)', { keyword })
            .orderBy('user.username', 'ASC')
            .take(Math.min(limit, 50))
            .getMany();

        return users.map(toPublicProfile);
    }

    async getPublicProfile(targetUserId: string): Promise<PublicUserProfile> {
        const user = await this.userRepository.findOne({ where: { id: targetUserId } });
        if (!user) {
            throw new NotFoundException(`User with ID ${targetUserId} not found`);
        }
        return toPublicProfile(user);
    }
}

