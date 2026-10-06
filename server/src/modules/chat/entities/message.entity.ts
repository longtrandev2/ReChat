import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "../../users/entities/user.entity.js";
import { Room } from "../../rooms/entities/room.entity.js";

/*
- **Message Entity**:
  - `id`: string (UUID, Primary Key)
  - `content`: string (TEXT, Not Null)
  - `senderId`: string (UUID, Foreign Key -> User.id)
  - `roomId`: string (UUID, Foreign Key -> Room.id)
  - `createdAt`: Date (DATETIME)
  */

@Entity('messages')
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'text' })
    content: string

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    sender: User;

    @ManyToOne(() => Room, { onDelete: 'CASCADE' })
    room: Room;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}