import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

/**
 * bcrypt chỉ băm tối đa 72 BYTE; @MaxLength đếm ký tự nên chuỗi có dấu/emoji có thể vượt 72 byte
 * và phần dư bị bỏ qua âm thầm. Constraint này kiểm tra độ dài theo UTF-8 bytes (constraints[0] = giới hạn).
 */
@ValidatorConstraint({ name: 'maxUtf8Bytes', async: false })
export class MaxUtf8BytesConstraint implements ValidatorConstraintInterface {
    validate(value: unknown, args: ValidationArguments): boolean {
        if (typeof value !== 'string') return false;
        const [maxBytes] = args.constraints as [number];
        return Buffer.byteLength(value, 'utf8') <= maxBytes;
    }

    defaultMessage(args: ValidationArguments): string {
        return `${args.property} tối đa ${args.constraints[0]} byte (UTF-8)`;
    }
}
