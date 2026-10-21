import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Conversation } from './conversation.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum ConversationRole {
    OWNER = 'OWNER',
    ADMIN = 'ADMIN',
    MEMBER = 'MEMBER',
}

@Entity('conversation_members')
@Unique(['conversation', 'user'])
export class ConversationMember {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Conversation, (conversation) => conversation.members, {
        onDelete: 'CASCADE',
    })
    conversation: Relation<Conversation>;

    @ManyToOne(() => User, {
        onDelete: 'CASCADE',
    })
    user: User;

    @Column({
        type: 'enum',
        enum: ConversationRole,
        default: ConversationRole.MEMBER,
    })
    role: ConversationRole;

    @Column({ nullable: true, type: 'uuid' })
    lastReadMessageId?: string;

    @Column({ type: 'int', default: 0 })
    unreadCount: number;

    @CreateDateColumn()
    joinedAt: Date;
}
