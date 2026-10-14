import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation, ConversationType } from './entities/conversation.entity.js';
import { ConversationMember, ConversationRole } from './entities/conversation-member.entity.js';
import { Message } from './entities/message.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Friendship, FriendshipStatus } from '../friends/entities/friendship.entity.js';
import { CreateGroupDto, AddMembersDto, GetMessagesQueryDto } from './dto/index.js';

@Injectable()
export class ConversationsService {
    constructor(
        @InjectRepository(Conversation)
        private readonly conversationRepository: Repository<Conversation>,

        @InjectRepository(ConversationMember)
        private readonly memberRepository: Repository<ConversationMember>,

        @InjectRepository(Message)
        private readonly messageRepository: Repository<Message>,

        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        @InjectRepository(Friendship)
        private readonly friendshipRepository: Repository<Friendship>,
    ) { }

    /**
     * Tạo hoặc lấy cuộc hội thoại 1-1 (DIRECT) giữa 2 người bạn (BR-05, FR-10)
     */
    async createOrGetDirect(currentUserId: string, targetUserId: string): Promise<Conversation> {
        if (currentUserId === targetUserId) {
            throw new BadRequestException('Không thể tự tạo cuộc hội thoại với chính mình');
        }

        const targetUser = await this.userRepository.findOne({
            where: {
                id: targetUserId,
            },
        });

        if (!targetUser) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        const friendship = await this.friendshipRepository.findOne({
            where: [
                { requester: { id: currentUserId }, addressee: { id: targetUserId }, status: FriendshipStatus.ACCEPTED },
                { requester: { id: targetUserId }, addressee: { id: currentUserId }, status: FriendshipStatus.ACCEPTED },
            ],
        });

        if (!friendship) {
            throw new ForbiddenException('Chỉ có thể nhắn tin với người là bạn bè');
        }

        // Tìm cuộc hội thoại DIRECT đã tồn tại giữa 2 người (BR-05)
        const existingConversation = await this.conversationRepository
            .createQueryBuilder('c')
            .innerJoin('c.members', 'm1')
            .innerJoin('c.members', 'm2')
            .where('c.type = :type', { type: ConversationType.DIRECT })
            .andWhere('m1.userId = :currentUserId', { currentUserId })
            .andWhere('m2.userId = :targetUserId', { targetUserId })
            .getOne();

        if (existingConversation) {
            return existingConversation;
        }

        // Tạo cuộc hội thoại mới nếu chưa có
        const newConversation = this.conversationRepository.create({
            type: ConversationType.DIRECT,
        });
        const savedConversation = await this.conversationRepository.save(newConversation);

        const member1 = this.memberRepository.create({
            conversation: savedConversation,
            user: { id: currentUserId } as User,
            role: ConversationRole.MEMBER,
        });

        const member2 = this.memberRepository.create({
            conversation: savedConversation,
            user: targetUser,
            role: ConversationRole.MEMBER,
        });

        await this.memberRepository.save([member1, member2]);

        return savedConversation;
    }

    /**
     * Tạo nhóm chat mới (BR-06, BR-07)
     */
    async createGroup(ownerId: string, dto: CreateGroupDto): Promise<Conversation> {
        // 1. Lọc bỏ ownerId nếu client lỡ gửi kèm chính mình, và loại bỏ các ID trùng lặp
        const uniqueMemberIds = [...new Set(dto.memberIds.filter((id) => id !== ownerId))];

        // 2. Kiểm tra số lượng thành viên tối thiểu sau khi lọc (BR-07)
        if (uniqueMemberIds.length < 1) {
            throw new BadRequestException('Nhóm chat phải có ít nhất 1 thành viên khác');
        }

        // 3. Kiểm tra tất cả các thành viên có tồn tại trong hệ thống không
        const existingUsers = await this.userRepository.find({
            where: { id: In(uniqueMemberIds) },
            select: { id: true },
        });

        if (existingUsers.length !== uniqueMemberIds.length) {
            throw new NotFoundException('Một hoặc nhiều người dùng không tồn tại');
        }

        // 4. Tạo cuộc hội thoại GROUP (BR-06)
        const newGroup = this.conversationRepository.create({
            type: ConversationType.GROUP,
            name: dto.name.trim(),
        });
        const savedGroup = await this.conversationRepository.save(newGroup);

        // 5. Tạo thành viên: Owner (role: OWNER) và các thành viên khác (role: MEMBER)
        const ownerMember = this.memberRepository.create({
            conversation: savedGroup,
            user: { id: ownerId } as User,
            role: ConversationRole.OWNER,
        });

        const otherMembers = uniqueMemberIds.map((memberId) =>
            this.memberRepository.create({
                conversation: savedGroup,
                user: { id: memberId } as User,
                role: ConversationRole.MEMBER,
            }),
        );

        await this.memberRepository.save([ownerMember, ...otherMembers]);

        return savedGroup;
    }

    /**
     * Thêm thành viên vào nhóm chat (BR-08)
     */
    async addMembers(
        currentUserId: string,
        conversationId: string,
        dto: AddMembersDto,
    ): Promise<{ message: string; addedCount: number }> {
        // 1. Kiểm tra cuộc hội thoại có tồn tại không
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new NotFoundException('Cuộc hội thoại không tồn tại');
        }

        // 2. Không cho phép thêm thành viên vào cuộc trò chuyện 1-1
        if (conversation.type === ConversationType.DIRECT) {
            throw new BadRequestException('Không thể thêm thành viên vào cuộc trò chuyện 1-1');
        }

        // 3. Kiểm tra người thực hiện có phải thành viên của nhóm không (BR-08)
        const currentMember = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!currentMember) {
            throw new ForbiddenException('Bạn không phải thành viên của nhóm chat này');
        }

        // 4. Lọc danh sách ID không trùng lặp
        const uniqueMemberIds = [...new Set(dto.memberIds)];

        // 5. Kiểm tra người dùng có tồn tại trong hệ thống không
        const existingUsers = await this.userRepository.find({
            where: { id: In(uniqueMemberIds) },
            select: { id: true },
        });

        if (existingUsers.length !== uniqueMemberIds.length) {
            throw new NotFoundException('Một hoặc nhiều người dùng không tồn tại');
        }

        // 6. Lọc những người đã có sẵn trong nhóm
        const existingGroupMembers = await this.memberRepository.find({
            where: {
                conversation: { id: conversationId },
                user: { id: In(uniqueMemberIds) },
            },
            relations: { user: true },
        });

        const existingMemberUserIds = existingGroupMembers.map((m) => m.user.id);
        const newMemberIds = uniqueMemberIds.filter((id) => !existingMemberUserIds.includes(id));

        if (newMemberIds.length === 0) {
            throw new ConflictException('Tất cả người dùng được chọn đã là thành viên của nhóm');
        }

        // 7. Tạo và lưu bản ghi thành viên mới
        const newMembers = newMemberIds.map((userId) =>
            this.memberRepository.create({
                conversation,
                user: { id: userId } as User,
                role: ConversationRole.MEMBER,
            }),
        );

        await this.memberRepository.save(newMembers);

        return {
            message: 'Thêm thành viên thành công',
            addedCount: newMembers.length,
        };
    }

    /**
     * Rời khỏi nhóm chat và chuyển giao quyền Owner nếu cần (BR-12)
     */
    async leaveGroup(
        currentUserId: string,
        conversationId: string,
    ): Promise<{ message: string }> {
        // 1. Kiểm tra cuộc hội thoại
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new NotFoundException('Cuộc hội thoại không tồn tại');
        }

        if (conversation.type === ConversationType.DIRECT) {
            throw new BadRequestException('Không thể rời khỏi cuộc trò chuyện 1-1');
        }

        // 2. Tìm bản ghi thành viên của currentUserId
        const currentMember = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!currentMember) {
            throw new NotFoundException('Bạn không phải thành viên của nhóm này');
        }

        const isOwner = currentMember.role === ConversationRole.OWNER;

        // 3. Xóa tư cách thành viên của currentUserId
        await this.memberRepository.delete(currentMember.id);

        // 4. Nếu người rời đi là OWNER -> Thực thi luật chuyển giao BR-12
        if (isOwner) {
            const remainingMembers = await this.memberRepository.find({
                where: { conversation: { id: conversationId } },
                order: { joinedAt: 'ASC' },
            });

            // Trường hợp 1: Nhóm còn thành viên khác -> Thăng cấp người gia nhập sớm nhất làm OWNER
            if (remainingMembers.length > 0) {
                const nextOwner = remainingMembers[0];
                nextOwner.role = ConversationRole.OWNER;
                await this.memberRepository.save(nextOwner);

                return { message: 'Đã rời nhóm thành công. Quyền trưởng nhóm đã được chuyển giao.' };
            }

            // Trường hợp 2: Không còn ai trong nhóm (Owner là người cuối cùng) -> Giải tán nhóm
            await this.conversationRepository.delete(conversationId);
            return { message: 'Đã rời nhóm và giải tán nhóm thành công' };
        }

        return { message: 'Đã rời nhóm thành công' };
    }

    /**
     * Lấy danh sách Inbox của user hiện tại (FR-09)
     * Trả về danh sách cuộc hội thoại, sắp xếp theo lastMessageAt DESC,
     * tự động bóc tách avatar/tên cho 1-1 hoặc nhóm, kèm unreadCount và lastMessage.
     */
    async getInbox(currentUserId: string): Promise<any[]> {
        // 1. Lấy tất cả cuộc trò chuyện mà currentUserId tham gia, kèm thành viên
        const conversations = await this.conversationRepository
            .createQueryBuilder('c')
            .innerJoin('c.members', 'm', 'm.userId = :currentUserId', { currentUserId })
            .leftJoinAndSelect('c.members', 'all_members')
            .leftJoinAndSelect('all_members.user', 'member_user')
            .orderBy('c.lastMessageAt', 'DESC')
            .addOrderBy('c.createdAt', 'DESC')
            .getMany();

        if (conversations.length === 0) {
            return [];
        }

        // 2. Tối ưu: Lấy các lastMessage trong 1 query duy nhất qua In(lastMessageIds) để triệt tiêu N+1
        const lastMessageIds = conversations
            .map((c) => c.lastMessageId)
            .filter((id): id is string => Boolean(id));

        let lastMessageMap = new Map<string, Message>();
        if (lastMessageIds.length > 0) {
            const lastMessages = await this.messageRepository.find({
                where: { id: In(lastMessageIds) },
                relations: { sender: true },
            });
            lastMessageMap = new Map(lastMessages.map((msg) => [msg.id, msg]));
        }

        // 3. Biến đổi dữ liệu (Projection) theo góc nhìn của currentUserId
        return conversations.map((c) => {
            const myMember = c.members.find((m) => m.user.id === currentUserId);
            let displayName = c.name;
            let avatarUrl = c.avatarUrl;

            if (c.type === ConversationType.DIRECT) {
                const partner = c.members.find((m) => m.user.id !== currentUserId)?.user;
                displayName = partner?.displayName || partner?.username || 'Người dùng';
                avatarUrl = partner?.avatarUrl;
            }

            const lastMsg = c.lastMessageId ? lastMessageMap.get(c.lastMessageId) : null;

            return {
                id: c.id,
                type: c.type,
                name: displayName,
                avatarUrl,
                unreadCount: myMember ? myMember.unreadCount : 0,
                lastMessage: lastMsg
                    ? {
                        id: lastMsg.id,
                        content: lastMsg.content,
                        type: lastMsg.type,
                        createdAt: lastMsg.createdAt,
                        sender: {
                            id: lastMsg.sender.id,
                            username: lastMsg.sender.username,
                            displayName: lastMsg.sender.displayName,
                            avatarUrl: lastMsg.sender.avatarUrl,
                        },
                    }
                    : null,
                lastMessageAt: c.lastMessageAt || c.createdAt,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            };
        });
    }

    /**
     * Lấy lịch sử tin nhắn của cuộc hội thoại bằng Cursor Pagination (FR-13, BR-08)
     */
    async getMessages(
        currentUserId: string,
        conversationId: string,
        query: GetMessagesQueryDto,
    ): Promise<Message[]> {
        // 1. Kiểm tra cuộc hội thoại tồn tại
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new NotFoundException('Cuộc hội thoại không tồn tại');
        }

        // 2. Kiểm tra quyền truy cập: Người gửi request phải thuộc cuộc trò chuyện (BR-08)
        const isMember = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!isMember) {
            throw new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này');
        }

        // 3. Xây dựng Cursor Query
        const limit = query.limit || 30;

        const qb = this.messageRepository
            .createQueryBuilder('m')
            .leftJoinAndSelect('m.sender', 'sender')
            .where('m.conversationId = :conversationId', { conversationId });

        // Nếu có con trỏ before: Lấy tin nhắn trước mốc đó
        if (query.before) {
            const beforeMessage = await this.messageRepository.findOne({
                where: {
                    id: query.before,
                    conversation: { id: conversationId },
                },
                select: { id: true, createdAt: true },
            });

            if (!beforeMessage) {
                throw new BadRequestException('Tin nhắn mốc (before cursor) không tồn tại trong hội thoại này');
            }

            qb.andWhere('m.createdAt < :beforeTime', { beforeTime: beforeMessage.createdAt });
        }

        qb.orderBy('m.createdAt', 'DESC').take(limit);

        const messages = await qb.getMany();

        // 4. Đảo ngược mảng để trả về theo thứ tự thời gian tăng dần (ASC: cũ -> mới)
        return messages.reverse();
    }

    /**
     * Đánh dấu đã đọc toàn bộ tin nhắn trong hội thoại (FR-16, BR-10)
     */
    async markAsRead(
        currentUserId: string,
        conversationId: string,
    ): Promise<{ message: string }> {
        // 1. Kiểm tra thành viên
        const member = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!member) {
            throw new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này');
        }

        // 2. Lấy lastMessageId của cuộc hội thoại
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
            select: { id: true, lastMessageId: true },
        });

        // 3. Reset unreadCount = 0 và cập nhật lastReadMessageId (BR-10)
        member.unreadCount = 0;
        if (conversation?.lastMessageId) {
            member.lastReadMessageId = conversation.lastMessageId;
        }

        await this.memberRepository.save(member);

        return { message: 'Đã đánh dấu đã đọc thành công' };
    }
}
