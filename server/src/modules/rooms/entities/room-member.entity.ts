/*- **RoomMember Entity** (Bảng trung gian N-N):
  - `id`: string (UUID, Primary Key)
  - `userId`: string (UUID, Foreign Key -> User.id)
  - `roomId`: string (UUID, Foreign Key -> Room.id)
  - `role`: enum (`'OWNER'`, `'MEMBER'`)
  - `joinedAt`: Date (DATETIME)
  */

import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm"
import { User } from "../../users/entities/user.entity.js";
import { Room } from "./room.entity.js";

export enum RoomRole {
    MEMBER = 'MEMBER',
    OWNER = 'OWNER',
}

@Entity('room_members')
export class RoomMember {

    @PrimaryGeneratedColumn('uuid')
    id: string

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user: User;

    @ManyToOne(() => Room, { onDelete: 'CASCADE' })
    room: Room;

    @Column({ type: 'enum', enum: RoomRole, default: RoomRole.MEMBER })
    role: RoomRole;

    @CreateDateColumn({})
    joinedAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}