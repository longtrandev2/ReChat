import { registerDecorator, ValidationOptions } from 'class-validator';

// String.raw giữ nguyên dấu \ cho RegExp (cờ 'u' bật Unicode property escapes)
const MODIFIERS = String.raw`[️\u{1F3FB}-\u{1F3FF}]*`;
const PICTOGRAPH = String.raw`\p{Extended_Pictographic}${MODIFIERS}`;
/** Emoji đơn: pictograph (+ variation selector / skin tone), chuỗi ZWJ, cờ (2 regional indicator), keycap */
const SINGLE_EMOJI = String.raw`(?:${PICTOGRAPH}(?:‍${PICTOGRAPH})*|[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]️?⃣)`;
const EMOJI_ONLY_REGEX = new RegExp(`^(?:${SINGLE_EMOJI})+$`, 'u');

export const EMOJI_MAX_LENGTH = 32;

/** Chuỗi chỉ gồm emoji hợp lệ (Unicode Extended_Pictographic, ZWJ, variation selector), tối đa 32 ký tự (BR-29) */
export function isEmojiString(value: unknown, maxLength = EMOJI_MAX_LENGTH): boolean {
    return typeof value === 'string' && value.length > 0 && value.length <= maxLength && EMOJI_ONLY_REGEX.test(value);
}

export function IsEmoji(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string) => {
        registerDecorator({
            name: 'isEmoji',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate: (value: unknown) => isEmojiString(value),
            },
        });
    };
}
