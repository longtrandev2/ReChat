import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Message } from './message.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('message_reactions')
@Index(['message', 'user'], { unique: true })
@Index(['message', 'emoji'])
export class MessageReaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Message, (message) => message.reactions, {
        onDelete: 'CASCADE',
    })
    message: Relation<Message>;

    @ManyToOne(() => User, {
        onDelete: 'CASCADE',
    })
    user: User;

    @Column({ length: 32 })
    emoji: string;

    @CreateDateColumn()
    createdAt: Date;
}
