import { createParamDecorator, ExecutionContext } from "@nestjs/common";

// Decorator này được viết để lấy ra user hiện tại
// Thay cho @Req() req: Request -> user = req.user as User
// -> cồng kềnh
export const CurrentUser = createParamDecorator(
    (data: string | undefined, ctx: ExecutionContext) => {
        // 1. Chuyển ngữ cảnh sang HTTP Request(lý do là cxt trong nestjs đa năng chứa thông tin của nhiều loại rq)
        // -> Đang làm việc với REST nên switch qua http
        const request = ctx.switchToHttp().getRequest();
        const user = request.user; // Được JwtStrategy gán vào từ đoạn trước.

        //2. Nếu cần lọc filed thì có thể truyền key
        //Optional ? tránh null + với dynamic [] 
        return data ? user?.[data] : user;
    }
)