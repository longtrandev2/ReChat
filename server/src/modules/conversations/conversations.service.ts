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
import { Message, MessageType } from './entities/message.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Friendship, FriendshipStatus } from '../friends/entities/friendship.entity.js';
import {
    CreateGroupDto,
    AddMembersDto,
    GetMessagesQueryDto,
    TransferOwnerDto,
    UpdateMemberRoleDto,
    UpdateGroupDto,
    GetMediaQueryDto,
    SendMessageDto,
} from './dto/index.js';

import { EventEmitter2 } from '@nestjs/event-emitter';
import {
    ConversationCreatedEvent,
    InboxUpdatedEvent,
    GroupMemberEvent,
    MessagePinnedEvent,
} from '../../common/events/index.js';

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

        private readonly eventEmitter: EventEmitter2,
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

        // Phát domain event để FE của cả 2 phía lập tức hiển thị conversation mới vào danh sách Inbox
        this.eventEmitter.emit(
            'conversation.created',
            new ConversationCreatedEvent(
                savedConversation.id,
                [currentUserId, targetUserId],
                savedConversation,
            ),
        );

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

        // Phát domain event để FE của tất cả thành viên trong nhóm lập tức thấy nhóm mới trong Inbox
        this.eventEmitter.emit(
            'conversation.created',
            new ConversationCreatedEvent(
                savedGroup.id,
                [ownerId, ...uniqueMemberIds],
                savedGroup,
            ),
        );

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

        const savedMembers = await this.memberRepository.save(newMembers);

        // Phát domain event để FE cập nhật danh sách thành viên và thông báo vào room
        this.eventEmitter.emit(
            'group.member_event',
            new GroupMemberEvent(
                conversationId,
                'ADDED',
                { id: currentUserId, displayName: currentUserId },
                newMemberIds,
                savedMembers,
            ),
        );

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

                this.eventEmitter.emit(
                    'group.member_event',
                    new GroupMemberEvent(
                        conversationId,
                        'LEFT',
                        { id: currentUserId, displayName: currentUserId },
                        [currentUserId],
                    ),
                );

                return { message: 'Đã rời nhóm thành công. Quyền trưởng nhóm đã được chuyển giao.' };
            }

            // Trường hợp 2: Không còn ai trong nhóm (Owner là người cuối cùng) -> Giải tán nhóm
            await this.conversationRepository.delete(conversationId);
            return { message: 'Đã rời nhóm và giải tán nhóm thành công' };
        }

        this.eventEmitter.emit(
            'group.member_event',
            new GroupMemberEvent(
                conversationId,
                'LEFT',
                { id: currentUserId, displayName: currentUserId },
                [currentUserId],
            ),
        );

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
    ): Promise<{ message: string; lastReadMessageId?: string }> {
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

        return {
            message: 'Đã đánh dấu đã đọc thành công',
            lastReadMessageId: member.lastReadMessageId,
        };
    }

    /**
     * Lấy thông tin chi tiết cuộc hội thoại và danh sách thành viên (FR-18, BR-08)
     */
    async getConversationDetail(
        currentUserId: string,
        conversationId: string,
    ): Promise<any> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
            relations: {
                members: {
                    user: true,
                },
            },
        });

        if (!conversation) {
            throw new NotFoundException('Cuộc hội thoại không tồn tại');
        }

        const currentMember = conversation.members.find(
            (m) => m.user.id === currentUserId,
        );

        if (!currentMember) {
            throw new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này');
        }

        let displayName = conversation.name;
        let avatarUrl = conversation.avatarUrl;

        if (conversation.type === ConversationType.DIRECT) {
            const partner = conversation.members.find(
                (m) => m.user.id !== currentUserId,
            )?.user;
            displayName = partner?.displayName || partner?.username || 'Người dùng';
            avatarUrl = partner?.avatarUrl;
        }

        return {
            id: conversation.id,
            type: conversation.type,
            name: displayName,
            avatarUrl,
            currentUserRole: currentMember.role,
            unreadCount: currentMember.unreadCount,
            members: conversation.members.map((m) => ({
                id: m.id,
                role: m.role,
                joinedAt: m.joinedAt,
                user: {
                    id: m.user.id,
                    username: m.user.username,
                    displayName: m.user.displayName,
                    avatarUrl: m.user.avatarUrl,
                    isOnline: m.user.isOnline,
                    lastSeen: m.user.lastSeen,
                },
            })),
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
        };
    }

    /**
     * Cập nhật thông tin nhóm chat: Tên nhóm, ảnh đại diện (FR-19, BR-17)
     * BR-17: Mọi thành viên trong nhóm đều có quyền cập nhật
     */
    async updateGroup(
        currentUserId: string,
        conversationId: string,
        dto: UpdateGroupDto,
    ): Promise<Conversation> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new NotFoundException('Cuộc hội thoại không tồn tại');
        }

        if (conversation.type === ConversationType.DIRECT) {
            throw new BadRequestException('Không thể cập nhật thông tin cuộc trò chuyện 1-1');
        }

        const member = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!member) {
            throw new ForbiddenException('Bạn không phải thành viên của nhóm này');
        }

        if (dto.name !== undefined) {
            conversation.name = dto.name.trim();
        }

        if (dto.avatarUrl !== undefined) {
            conversation.avatarUrl = dto.avatarUrl;
        }

        return this.conversationRepository.save(conversation);
    }

    /**
     * Xóa thành viên khỏi nhóm chat - Kick member (FR-18, BR-14)
     * - Chỉ OWNER hoặc ADMIN mới có quyền kick
     * - ADMIN không thể kick OWNER hoặc ADMIN khác
     * - OWNER có thể kick bất kỳ ai trừ chính mình
     */
    async kickMember(
        currentUserId: string,
        conversationId: string,
        targetUserId: string,
    ): Promise<{ message: string }> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new NotFoundException('Cuộc hội thoại không tồn tại');
        }

        if (conversation.type === ConversationType.DIRECT) {
            throw new BadRequestException('Không thể xóa thành viên khỏi cuộc trò chuyện 1-1');
        }

        if (currentUserId === targetUserId) {
            throw new BadRequestException('Không thể tự xóa chính mình khỏi nhóm, hãy sử dụng tính năng rời nhóm');
        }

        const currentMember = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!currentMember) {
            throw new ForbiddenException('Bạn không phải thành viên của nhóm này');
        }

        if (currentMember.role === ConversationRole.MEMBER) {
            throw new ForbiddenException('Chỉ Trưởng nhóm hoặc Phó nhóm mới có quyền xóa thành viên');
        }

        const targetMember = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: targetUserId },
            },
        });

        if (!targetMember) {
            throw new NotFoundException('Thành viên không tồn tại trong nhóm này');
        }

        if (targetMember.role === ConversationRole.OWNER) {
            throw new ForbiddenException('Không thể xóa Trưởng nhóm khỏi nhóm');
        }

        if (currentMember.role === ConversationRole.ADMIN && targetMember.role === ConversationRole.ADMIN) {
            throw new ForbiddenException('Phó nhóm không có quyền xóa Phó nhóm khác');
        }

        await this.memberRepository.delete(targetMember.id);

        this.eventEmitter.emit(
            'group.member_event',
            new GroupMemberEvent(
                conversationId,
                'REMOVED',
                { id: currentUserId, displayName: currentUserId },
                [targetUserId],
            ),
        );

        return { message: 'Đã xóa thành viên khỏi nhóm chat thành công' };
    }

    /**
     * Chuyển giao quyền Trưởng nhóm (FR-18, BR-15)
     * - Chỉ OWNER mới có quyền chuyển giao
     * - Sau khi chuyển: người nhận thành OWNER, người cũ chuyển thành ADMIN
     */
    async transferOwnership(
        currentUserId: string,
        conversationId: string,
        dto: TransferOwnerDto,
    ): Promise<{ message: string }> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new NotFoundException('Cuộc hội thoại không tồn tại');
        }

        if (conversation.type === ConversationType.DIRECT) {
            throw new BadRequestException('Không thể chuyển quyền trong cuộc trò chuyện 1-1');
        }

        const currentMember = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!currentMember || currentMember.role !== ConversationRole.OWNER) {
            throw new ForbiddenException('Chỉ Trưởng nhóm mới có quyền chuyển giao quyền Trưởng nhóm');
        }

        if (currentUserId === dto.newOwnerId) {
            throw new BadRequestException('Bạn đã là Trưởng nhóm của cuộc trò chuyện này');
        }

        const newOwnerMember = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: dto.newOwnerId },
            },
        });

        if (!newOwnerMember) {
            throw new NotFoundException('Người dùng được chọn không phải là thành viên của nhóm chat');
        }

        newOwnerMember.role = ConversationRole.OWNER;
        currentMember.role = ConversationRole.ADMIN;

        await this.memberRepository.save([newOwnerMember, currentMember]);

        return { message: 'Chuyển giao quyền Trưởng nhóm thành công' };
    }

    /**
     * Thay đổi vai trò thành viên - Thăng/Giáng cấp Admin (FR-18, BR-16)
     * - Chỉ OWNER mới có quyền thay đổi vai trò
     * - Không thể tự đổi vai trò của chính mình
     */
    async updateMemberRole(
        currentUserId: string,
        conversationId: string,
        targetUserId: string,
        dto: UpdateMemberRoleDto,
    ): Promise<{ message: string; member: { id: string; userId: string; role: ConversationRole } }> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new NotFoundException('Cuộc hội thoại không tồn tại');
        }

        if (conversation.type === ConversationType.DIRECT) {
            throw new BadRequestException('Không thể thay đổi vai trò trong cuộc trò chuyện 1-1');
        }

        const currentMember = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!currentMember || currentMember.role !== ConversationRole.OWNER) {
            throw new ForbiddenException('Chỉ Trưởng nhóm mới có quyền thay đổi vai trò của thành viên');
        }

        if (currentUserId === targetUserId) {
            throw new BadRequestException('Không thể tự thay đổi vai trò của chính mình');
        }

        const targetMember = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: targetUserId },
            },
            relations: { user: true },
        });

        if (!targetMember) {
            throw new NotFoundException('Thành viên không tồn tại trong nhóm chat');
        }

        targetMember.role = dto.role;
        await this.memberRepository.save(targetMember);

        return {
            message: 'Cập nhật vai trò thành viên thành công',
            member: {
                id: targetMember.id,
                userId: targetMember.user.id,
                role: targetMember.role,
            },
        };
    }

    /**
     * Ghim tin nhắn trong cuộc trò chuyện (FR-20, BR-18)
     */
    async pinMessage(
        currentUserId: string,
        conversationId: string,
        messageId: string,
    ): Promise<Message> {
        const member = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!member) {
            throw new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này');
        }

        const message = await this.messageRepository.findOne({
            where: {
                id: messageId,
                conversation: { id: conversationId },
            },
            relations: { sender: true },
        });

        if (!message) {
            throw new NotFoundException('Tin nhắn không tồn tại trong cuộc hội thoại này');
        }

        if (message.isRecalled) {
            throw new BadRequestException('Không thể ghim tin nhắn đã bị thu hồi');
        }

        message.isPinned = true;
        message.pinnedAt = new Date();
        message.pinnedBy = { id: currentUserId } as User;

        const saved = await this.messageRepository.save(message);

        // Bắn domain event để FE hiển thị thanh Pin Bar trên đỉnh khung chat
        this.eventEmitter.emit(
            'message.pinned',
            new MessagePinnedEvent(
                conversationId,
                messageId,
                true,
                {
                    id: saved.id,
                    content: saved.content,
                    senderName: saved.sender?.displayName || saved.sender?.username,
                },
                { id: currentUserId, displayName: currentUserId },
            ),
        );

        return saved;
    }

    /**
     * Bỏ ghim tin nhắn trong cuộc trò chuyện (FR-20, BR-18)
     * - Người ghim hoặc OWNER / ADMIN có quyền bỏ ghim
     */
    async unpinMessage(
        currentUserId: string,
        conversationId: string,
        messageId: string,
    ): Promise<{ message: string }> {
        const member = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!member) {
            throw new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này');
        }

        const message = await this.messageRepository.findOne({
            where: {
                id: messageId,
                conversation: { id: conversationId },
            },
            relations: { pinnedBy: true },
        });

        if (!message) {
            throw new NotFoundException('Tin nhắn không tồn tại trong cuộc hội thoại này');
        }

        if (!message.isPinned) {
            throw new BadRequestException('Tin nhắn này chưa được ghim');
        }

        const isPinner = message.pinnedBy?.id === currentUserId;
        const isStaff = member.role === ConversationRole.OWNER || member.role === ConversationRole.ADMIN;

        if (!isPinner && !isStaff) {
            throw new ForbiddenException('Bạn không có quyền bỏ ghim tin nhắn này');
        }

        message.isPinned = false;
        message.pinnedAt = null as any;
        message.pinnedBy = null as any;

        await this.messageRepository.save(message);

        // Bắn domain event để FE gỡ tin nhắn khỏi thanh Pin Bar
        this.eventEmitter.emit(
            'message.pinned',
            new MessagePinnedEvent(
                conversationId,
                messageId,
                false,
            ),
        );

        return { message: 'Bỏ ghim tin nhắn thành công' };
    }

    /**
     * Lấy danh sách các tin nhắn đang được ghim trong cuộc trò chuyện (FR-20, BR-18)
     */
    async getPinnedMessages(
        currentUserId: string,
        conversationId: string,
    ): Promise<Message[]> {
        const member = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!member) {
            throw new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này');
        }

        return this.messageRepository.find({
            where: {
                conversation: { id: conversationId },
                isPinned: true,
                isRecalled: false,
            },
            relations: {
                sender: true,
                pinnedBy: true,
            },
            order: {
                pinnedAt: 'DESC',
            },
        });
    }

    /**
     * Lấy danh sách ảnh và tệp tin đa phương tiện trong cuộc hội thoại (FR-21, BR-19)
     * Hỗ trợ lọc theo loại tin nhắn (IMAGE, FILE) và phân trang con trỏ (Cursor pagination)
     */
    async getMediaMessages(
        currentUserId: string,
        conversationId: string,
        query: GetMediaQueryDto,
    ): Promise<Message[]> {
        const member = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: currentUserId },
            },
        });

        if (!member) {
            throw new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này');
        }

        const limit = query.limit || 30;

        const qb = this.messageRepository
            .createQueryBuilder('m')
            .leftJoinAndSelect('m.sender', 'sender')
            .where('m.conversationId = :conversationId', { conversationId })
            .andWhere('m.isRecalled = false');

        if (query.type) {
            qb.andWhere('m.type = :type', { type: query.type });
        } else {
            qb.andWhere('m.type IN (:...types)', { types: [MessageType.IMAGE, MessageType.FILE] });
        }

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

        return qb.getMany();
    }

    /**
     * Kiểm tra trạng thái hoạt động (Active presence) của cuộc hội thoại (FR-22, BR-20)
     * - DIRECT: Active khi đối phương đang isOnline === true
     * - GROUP: Active khi có ít nhất 1 thành viên khác (ngoại trừ user hiện tại) đang isOnline === true
     */
    async getConversationActiveStatus(
        currentUserId: string,
        conversationId: string,
    ): Promise<{
        conversationId: string;
        type: ConversationType;
        isActive: boolean;
        activeMemberCount: number;
        totalMemberCount: number;
    }> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
            relations: {
                members: {
                    user: true,
                },
            },
        });

        if (!conversation) {
            throw new NotFoundException('Cuộc hội thoại không tồn tại');
        }

        const isMember = conversation.members.some((m) => m.user.id === currentUserId);
        if (!isMember) {
            throw new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này');
        }

        const otherMembers = conversation.members.filter((m) => m.user.id !== currentUserId);

        let isActive = false;
        let activeMemberCount = 0;

        if (conversation.type === ConversationType.DIRECT) {
            const partner = otherMembers[0]?.user;
            isActive = Boolean(partner?.isOnline);
            activeMemberCount = isActive ? 1 : 0;
        } else {
            activeMemberCount = otherMembers.filter((m) => Boolean(m.user?.isOnline)).length;
            isActive = activeMemberCount > 0;
        }

        return {
            conversationId: conversation.id,
            type: conversation.type,
            isActive,
            activeMemberCount,
            totalMemberCount: conversation.members.length,
        };
    }

    /**
     * Xác thực người dùng có phải thành viên của cuộc hội thoại hay không (BR-08)
     */
    async validateMembership(
        conversationId: string,
        userId: string,
    ): Promise<ConversationMember> {
        const member = await this.memberRepository.findOne({
            where: {
                conversation: { id: conversationId },
                user: { id: userId },
            },
            relations: {
                user: true,
            },
        });

        if (!member) {
            throw new ForbiddenException('Bạn không phải thành viên của cuộc hội thoại này');
        }

        return member;
    }

    /**
     * Tạo và lưu tin nhắn mới vào cuộc hội thoại (FR-15, BR-08, BR-09, BR-10)
     */
    async createMessage(
        senderId: string,
        dto: SendMessageDto,
    ): Promise<Message> {
        const { conversationId, content, type = MessageType.TEXT, fileUrl, replyToId } = dto;

        // 1. Kiểm tra thành viên hội thoại (BR-08)
        await this.validateMembership(conversationId, senderId);

        // 2. Validate nội dung tin nhắn (BR-09)
        if (!content || !content.trim()) {
            throw new BadRequestException('Nội dung tin nhắn không được để trống');
        }
        if (content.trim().length > 2000) {
            throw new BadRequestException('Nội dung tin nhắn không được vượt quá 2000 ký tự');
        }

        // 3. Nếu là replyTo, kiểm tra tin nhắn gốc có thuộc hội thoại này không
        if (replyToId) {
            const originalMessage = await this.messageRepository.findOne({
                where: {
                    id: replyToId,
                    conversation: { id: conversationId },
                },
            });
            if (!originalMessage) {
                throw new BadRequestException('Tin nhắn trả lời không tồn tại trong cuộc hội thoại này');
            }
        }

        // 4. Lưu tin nhắn mới vào DB
        const message = this.messageRepository.create({
            conversation: { id: conversationId } as Conversation,
            sender: { id: senderId } as User,
            content: content.trim(),
            type,
            fileUrl,
            replyToId,
        });
        const savedMessage = await this.messageRepository.save(message);

        // 5. Cập nhật lastMessageId và lastMessageAt của conversation
        await this.conversationRepository.update(conversationId, {
            lastMessageId: savedMessage.id,
            lastMessageAt: savedMessage.createdAt,
        });

        // 6. Tăng unreadCount cho các thành viên khác trong nhóm (BR-10)
        await this.memberRepository
            .createQueryBuilder()
            .update(ConversationMember)
            .set({ unreadCount: () => 'unreadCount + 1' })
            .where('conversationId = :conversationId', { conversationId })
            .andWhere('userId != :senderId', { senderId })
            .execute();

        // 7. Lấy lại tin nhắn kèm thông tin người gửi đầy đủ
        const fullMessage = await this.messageRepository.findOneOrFail({
            where: { id: savedMessage.id },
            relations: {
                sender: true,
            },
            select: {
                id: true,
                content: true,
                type: true,
                fileUrl: true,
                replyToId: true,
                isRecalled: true,
                isPinned: true,
                createdAt: true,
                updatedAt: true,
                sender: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                },
            },
        });

        // 8. Lấy danh sách thành viên để phát event inbox.updated cho những ai ngoài phòng
        const members = await this.memberRepository.find({
            where: { conversation: { id: conversationId } },
            relations: { user: true },
        });
        const memberIds = members.map((m) => m.user?.id || (m as any).userId).filter(Boolean);

        this.eventEmitter.emit(
            'inbox.updated',
            new InboxUpdatedEvent(
                conversationId,
                memberIds,
                {
                    id: fullMessage.id,
                    content: fullMessage.content,
                    type: fullMessage.type,
                    fileUrl: fullMessage.fileUrl,
                    senderName: fullMessage.sender.displayName || fullMessage.sender.username,
                    createdAt: fullMessage.createdAt,
                },
                senderId,
            ),
        );

        return fullMessage;
    }
}


