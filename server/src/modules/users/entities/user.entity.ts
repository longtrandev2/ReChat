import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn }
    from "typeorm";

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 20 })
    username: string;

    @Column()
    password: string;

    @Column({ nullable: true, length: 50 })
    displayName?: string;

    @Column({ nullable: true, length: 255 })
    avatarUrl?: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}