export function getVerifyEmailTemplate(username: string, otp: string): string {
    return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Xác thực tài khoản ReChat</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #18181b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fafafa; padding: 48px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04); overflow: hidden; text-align: left;">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 32px 36px 24px 36px; border-bottom: 1px solid #f4f4f5;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 28px; height: 28px; background-color: #09090b; border-radius: 7px; text-align: center; vertical-align: middle; color: #ffffff; font-size: 14px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                          R
                        </td>
                        <td style="padding-left: 10px; font-size: 16px; font-weight: 600; color: #09090b; letter-spacing: -0.3px;">
                          ReChat
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-size: 12px; font-weight: 500; color: #71717a; letter-spacing: 0.3px; text-transform: uppercase;">
                      Xác thực
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 36px 36px 36px;">
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; line-height: 28px; color: #09090b; letter-spacing: -0.4px;">
                Xác thực email của bạn
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #52525b;">
                Xin chào <strong style="color: #18181b;">${username}</strong>,<br />
                Cảm ơn bạn đã tham gia ReChat. Vui lòng nhập mã OTP dưới đây vào ứng dụng để hoàn tất kích hoạt tài khoản.
              </p>

              <!-- OTP Block -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <tr>
                  <td style="padding: 24px 20px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 10px;">
                      Mã xác thực tài khoản
                    </div>
                    <div style="font-family: ui-monospace, 'SF Mono', 'Cascadia Code', 'Segoe UI Mono', Menlo, Consolas, monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a; line-height: 1.2;">
                      ${otp}
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 10px;">
                      Mã có hiệu lực trong <strong>10 phút</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-left: 2px solid #e4e4e7; margin-bottom: 24px;">
                <tr>
                  <td style="padding-left: 14px;">
                    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #71717a;">
                      Tuyệt đối không chia sẻ mã này với bất kỳ ai để bảo vệ tài khoản của bạn. Nếu bạn không tạo tài khoản trên ReChat, bạn có thể an tâm bỏ qua email này.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; color: #a1a1aa; line-height: 20px;">
                — Đội ngũ ReChat
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px 28px 36px; background-color: #fafafa; border-top: 1px solid #f4f4f5; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #71717a;">
                © 2026 ReChat System. Mọi quyền được bảo lưu.
              </p>
              <p style="margin: 0; font-size: 11px; color: #a1a1aa;">
                Email này được gửi tự động. Vui lòng không trả lời trực tiếp.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
}
