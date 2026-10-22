export function getTwoFactorOtpTemplate(
    username: string,
    otp: string,
    action: 'setup' | 'login' = 'login',
): string {
    const isSetup = action === 'setup';
    const title = isSetup
        ? 'Xác nhận bật xác thực 2 bước (2FA)'
        : 'Mã xác thực 2 bước đăng nhập (2FA)';
    const introText = isSetup
        ? `Bạn vừa gửi yêu cầu kích hoạt bảo mật Xác thực 2 bước (2FA) qua Email cho tài khoản ReChat của mình. Vui lòng nhập mã bảo mật bên dưới để hoàn tất cài đặt:`
        : `Hệ thống ghi nhận một phiên đăng nhập mới vào tài khoản ReChat của bạn. Để xác minh danh tính và bảo vệ phiên làm việc, vui lòng nhập mã bảo mật bên dưới:`;
    const tag = isSetup ? 'KÍCH HOẠT 2FA' : 'XÁC THỰC 2FA';

    return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${title}</title>
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
                      ${tag}
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
                ${title}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #525866;">
                Xin chào <strong style="color: #0e1621;">${username}</strong>,<br />
                ${introText}
              </p>

              <!-- OTP Container -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0; background-color: #f0f7fd; border: 1.5px solid #c9e2f7; border-radius: 14px;">
                <tr>
                  <td style="padding: 26px 20px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #2481cc; margin-bottom: 8px;">
                      Mã xác thực 2 bước (2FA)
                    </div>
                    <div style="font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, Monaco, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0e1621; line-height: 1.2;">
                      ${otp}
                    </div>
                    <div style="font-size: 12px; color: #707579; margin-top: 10px; font-weight: 500;">
                      Mã có hiệu lực trong vòng <strong style="color: #2481cc;">5 phút</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Callout -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-left: 3px solid #2481cc; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0; font-size: 13px; line-height: 20px; color: #525866;">
                      <strong style="color: #0e1621;">Cảnh báo an toàn:</strong> ${isSetup
                        ? 'Tính năng xác thực 2 bước giúp bảo vệ tài khoản khỏi các hành vi truy cập trái phép ngay cả khi lộ mật khẩu.'
                        : 'Nếu bạn không yêu cầu đăng nhập này, rất có thể tài khoản của bạn đang gặp nguy cơ xâm phạm. Hãy đổi mật khẩu ngay lập tức.'}
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
