import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn }
    from "typeorm";
import { Exclude } from "class-transformer";

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true, length: 20 })
    username: string;

    @Column({ unique: true, length: 100, nullable: true })
    @Exclude() // Không lộ ra API khi trả entity User của người khác (sender, member…)
    email?: string;

    @Column({ default: false })
    @Exclude() // Không lộ ra API khi trả entity User của người khác (sender, member…)
    isEmailVerified: boolean;

    @Column({ default: false })
    @Exclude() // Không lộ ra API khi trả entity User của người khác (sender, member…)
    twoFactorEnabled: boolean;

    // Không bao giờ trả hash mật khẩu ra ngoài: mọi query phải chọn tường minh khi cần (login, đổi mật khẩu)

    @Column({ select: false })
    @Exclude() // Không lộ ra API khi trả entity User của người khác (sender, member…)
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