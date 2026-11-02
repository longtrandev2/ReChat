import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendMessageDto } from './send-message.dto.js';
import { UpdateQuickEmojiDto } from './update-quick-emoji.dto.js';
import { CustomizeConversationDto } from './customize-conversation.dto.js';
import { TogglePinDto } from './toggle-pin.dto.js';

const CONVERSATION_ID = '6b1f1c0e-9d3a-4e57-8a3e-0d2f4a8b1c11';

const validateSend = async (overrides: Record<string, unknown>) => {
    const dto = plainToInstance(SendMessageDto, { conversationId: CONVERSATION_ID, content: 'hello', ...overrides });
    return validate(dto);
};
const failedProps = (errors: Awaited<ReturnType<typeof validate>>) => errors.map((e) => e.property);

describe('SendMessageDto (BR-36)', () => {
    it.each(['TEXT', 'IMAGE', 'FILE'])('accepts type %s', async (type) => {
        expect(await validateSend({ type })).toHaveLength(0);
    });

    it('defaults to TEXT when type is omitted', async () => {
        const dto = plainToInstance(SendMessageDto, { conversationId: CONVERSATION_ID, content: 'hello' });
        expect(dto.type).toBe('TEXT');
        expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects type SYSTEM (forged system messages)', async () => {
        expect(failedProps(await validateSend({ type: 'SYSTEM' }))).toContain('type');
    });

    it('rejects unknown types', async () => {
        expect(failedProps(await validateSend({ type: 'ADMIN' }))).toContain('type');
    });

    it.each([
        'https://res.cloudinary.com/demo/image/upload/v1/rechat/images/pic.png',
        'http://localhost:3000/uploads/a.png',
    ])('accepts absolute http(s) fileUrl %s', async (fileUrl) => {
        expect(await validateSend({ type: 'IMAGE', fileUrl })).toHaveLength(0);
    });

    it.each(['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'ftp://example.com/a.png', '/relative/path.png', 'not a url'])(
        'rejects unsafe/relative fileUrl %s',
        async (fileUrl) => {
            expect(failedProps(await validateSend({ type: 'FILE', fileUrl }))).toContain('fileUrl');
        },
    );

    it('allows omitting fileUrl for TEXT messages', async () => {
        expect(await validateSend({})).toHaveLength(0);
    });
});

describe('Quick emoji validation (BR-29)', () => {
    const validateEmoji = async (emoji: unknown) =>
        validate(plainToInstance(UpdateQuickEmojiDto, { emoji }));

    it.each(['👍', '❤️', '🏸', '👨‍👩‍👧‍👦', '🇻🇳'])('accepts emoji %s', async (emoji) => {
        expect(await validateEmoji(emoji)).toHaveLength(0);
    });

    it.each(['abc', 'hello 👍', '<script>', '1', ''])('rejects non-emoji %j', async (emoji) => {
        expect((await validateEmoji(emoji)).length).toBeGreaterThan(0);
    });

    it('rejects emoji strings longer than 32 chars', async () => {
        expect((await validateEmoji('😀'.repeat(17))).length).toBeGreaterThan(0);
    });

    it('CustomizeConversationDto.quickEmoji is validated as an emoji too', async () => {
        const base = { conversationId: CONVERSATION_ID };
        expect(await validate(plainToInstance(CustomizeConversationDto, { ...base, quickEmoji: '🔥' }))).toHaveLength(0);
        const bad = await validate(plainToInstance(CustomizeConversationDto, { ...base, quickEmoji: 'fire' }));
        expect(failedProps(bad)).toContain('quickEmoji');
    });
});

describe('TogglePinDto (FR-48)', () => {
    it('accepts boolean isPinned', async () => {
        expect(await validate(plainToInstance(TogglePinDto, { isPinned: true }))).toHaveLength(0);
        expect(await validate(plainToInstance(TogglePinDto, { isPinned: false }))).toHaveLength(0);
    });

    it('rejects missing or non-boolean isPinned', async () => {
        expect((await validate(plainToInstance(TogglePinDto, {}))).length).toBeGreaterThan(0);
        expect((await validate(plainToInstance(TogglePinDto, { isPinned: 'true' }))).length).toBeGreaterThan(0);
    });
});
