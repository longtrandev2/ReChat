import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn }
    from "typeorm";

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 20 })
    username: string;

    @Column({ unique: true, length: 100, nullable: true })
    email?: string;

    @Column({ default: false })
    isEmailVerified: boolean;

    @Column({ default: false })
    twoFactorEnabled: boolean;

    @Column()
    password: string;

    @Column({ nullable: true, length: 50 })
    displayName?: string;

    @Column({ nullable: true, length: 255 })
    avatarUrl?: string;

    @Column({ default: false })
    isOnline: boolean;

    @Column({ nullable: true, type: 'datetime' })
    lastSeen?: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}