import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Conversation } from './conversation.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum MessageType {
    TEXT = 'TEXT',
    IMAGE = 'IMAGE',
    FILE = 'FILE',
}

@Entity('messages')
@Index(['conversation', 'createdAt'])
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
        onDelete: 'CASCADE',
    })
    conversation: Relation<Conversation>;

    @ManyToOne(() => User, {
        onDelete: 'CASCADE',
    })
    sender: User;

    @Column({ type: 'text' })
    content: string;

    @Column({
        type: 'enum',
        enum: MessageType,
        default: MessageType.TEXT,
    })
    type: MessageType;

    @Column({ nullable: true, length: 500 })
    fileUrl?: string;

    @Column({ nullable: true, type: 'uuid' })
    replyToId?: string;

    @Column({ default: false })
    isRecalled: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
