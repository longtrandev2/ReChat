export function getResetPasswordTemplate(username: string, resetLink: string): string {
    return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Đặt lại mật khẩu ReChat</title>
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
                      Bảo mật
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
                Yêu cầu đặt lại mật khẩu
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #52525b;">
                Xin chào <strong style="color: #18181b;">${username}</strong>,<br />
                Chúng tôi nhận được yêu cầu tạo lại mật khẩu mới cho tài khoản của bạn. Bấm vào nút bên dưới để tiến hành thiết lập mật khẩu mới:
              </p>

              <!-- CTA Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: #09090b; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 13px 28px; border-radius: 8px; letter-spacing: -0.2px;">
                      Đặt lại mật khẩu
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Fallback Link -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; line-height: 18px;">
                  Liên kết này có hiệu lực trong vòng <strong>15 phút</strong> và chỉ sử dụng được 1 lần. Nếu nút bấm không hoạt động, bạn có thể sao chép liên kết dưới đây vào trình duyệt:
                </p>
                <div style="font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 11px; color: #475569; word-break: break-all; line-height: 16px; background-color: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
                  ${resetLink}
                </div>
              </div>

              <!-- Security Notice -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-left: 2px solid #e4e4e7; margin-bottom: 24px;">
                <tr>
                  <td style="padding-left: 14px;">
                    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #71717a;">
                      Nếu bạn không thực hiện yêu cầu này, hãy yên tâm tài khoản của bạn vẫn an toàn và bạn có thể bỏ qua email này.
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
