export function getResetPasswordTemplate(username: string, resetLink: string): string {
    return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Đặt lại mật khẩu ReChat</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #111827;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f5f7; padding: 48px 16px;">
    <tr>
      <td align="center">
        <!-- Main Elevated Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e5e9eb; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); overflow: hidden; text-align: left;">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 28px 36px 20px 36px; border-bottom: 1px solid #f0f2f5;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 34px; height: 34px; background: #2481CC; border-radius: 10px; text-align: center; vertical-align: middle; color: #ffffff; font-size: 16px; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                          R
                        </td>
                        <td style="padding-left: 12px; font-size: 18px; font-weight: 700; color: #0e1621; letter-spacing: -0.4px;">
                          ReChat
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: #ebf5fb; color: #2481cc; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px;">
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
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; line-height: 30px; color: #0e1621; letter-spacing: -0.5px;">
                Yêu cầu đặt lại mật khẩu
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #525866;">
                Xin chào <strong style="color: #0e1621;">${username}</strong>,<br />
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu đăng nhập cho tài khoản ReChat của bạn. Nhấn vào nút bên dưới để tiến hành thiết lập mật khẩu mới:
              </p>

              <!-- CTA Button Container -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color: #2481cc; border-radius: 12px; box-shadow: 0 4px 14px rgba(36, 129, 204, 0.35);">
                          <a href="${resetLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2481cc; color: #ffffff !important; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 12px; letter-spacing: -0.2px;">
                            Đặt lại mật khẩu
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Fallback Direct Link -->
              <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; line-height: 18px;">
                  Liên kết này có hiệu lực trong vòng <strong style="color: #0e1621;">15 phút</strong> và chỉ sử dụng được một lần duy nhất. Nếu nút bấm phía trên không phản hồi, bạn có thể sao chép đường dẫn sau vào trình duyệt:
                </p>
                <div style="font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace; font-size: 11px; color: #2481cc; word-break: break-all; line-height: 16px; background-color: #ffffff; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                  ${resetLink}
                </div>
              </div>

              <!-- Security Notice -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-left: 3px solid #2481cc; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #525866;">
                      <strong style="color: #0e1621;">Bạn không thực hiện yêu cầu này?</strong> Hãy yên tâm, tài khoản của bạn vẫn an toàn và bạn có thể bỏ qua thư này. Mật khẩu hiện tại của bạn sẽ không bị thay đổi.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; color: #8e95a3; line-height: 20px;">
                Trân trọng,<br />
                <strong style="color: #525866;">Đội ngũ ReChat Security</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 22px 36px 26px 36px; background-color: #fafbfc; border-top: 1px solid #f0f2f5; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 500; color: #707579;">
                ReChat Messenger · Bảo mật &amp; Mã hóa thời gian thực
              </p>
              <p style="margin: 0; font-size: 11px; color: #a0a6b1;">
                © 2026 ReChat Inc. Đây là thông báo tự động từ hệ thống, vui lòng không trả lời thư này.
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
