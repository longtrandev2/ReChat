import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
@Module({
    imports: [
        // 1. Đăng ký User Entity cho TypeORM xử lý trong Module này
        TypeOrmModule.forFeature([User]),
    ],
    controllers: [], // Tạm thời để mảng rỗng (Tí nữa tạo Controller sẽ điền vào đây)
    providers: [],   // Tạm thời để mảng rỗng (Tí nữa tạo Service sẽ điền vào đây)
    exports: [
        // 2. Export TypeOrmModule ra ngoài để các Module khác (như AuthModule) có thể dùng được Repository<User>
        TypeOrmModule,
    ],
})
export class UsersModule { }