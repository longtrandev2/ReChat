/* Room Entity:

id: string (UUID, Primary Key)
name: string (VARCHAR 30, Unique, Not Null)
isPrivate: boolean (Default false)
password: string (VARCHAR 255, Nullable - hashed nếu private)
createdAt: Date (DATETIME, default NOW)
*/
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('rooms')
export class Room {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 30 })
    name: string;

    @Column({ default: false })
    isPrivate: boolean;

    @Column({ nullable: true, length: 255 })
    password: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}