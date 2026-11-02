import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { User } from "../../users/entities/user.entity.js";


export enum FriendshipStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    BLOCKED = 'BLOCKED'
}
@Entity('friendships')
@Unique(['requester', 'addressee'])
export class Friendship {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    requester: User;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    addressee: User;

    @Column({ type: 'enum', enum: FriendshipStatus, default: FriendshipStatus.PENDING })
    status: FriendshipStatus;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date


}