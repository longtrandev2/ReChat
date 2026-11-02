import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ConversationMember } from './conversation-member.entity.js';
import { Message } from './message.entity.js';

export enum ConversationType {
    DIRECT = 'DIRECT',
    GROUP = 'GROUP',
}

@Entity('conversations')
export class Conversation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: ConversationType,
        default: ConversationType.DIRECT,
    })
    type: ConversationType;

    @Column({ nullable: true, length: 50 })
    name?: string;

    @Column({ nullable: true, length: 500 })
    avatarUrl?: string;

    @Column({ nullable: true, length: 32, default: '👍' })
    quickEmoji?: string;

    /**
     * Khóa duy nhất cho hội thoại DIRECT: 2 userId sắp xếp tăng dần nối bằng ':' (BR-05).
     * NULL với GROUP (và dữ liệu DIRECT cũ); MySQL cho phép nhiều NULL trong unique index.
     */
    @Column({ type: 'varchar', length: 73, nullable: true, unique: true })
    directKey?: string | null;

    @Column({ nullable: true, type: 'uuid' })
    lastMessageId?: string;

    @Column({ nullable: true, type: 'datetime' })
    lastMessageAt?: Date;

    @OneToMany(() => ConversationMember, (member) => member.conversation)
    members: Relation<ConversationMember>[];

    @OneToMany(() => Message, (message) => message.conversation)
    messages: Relation<Message>[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
