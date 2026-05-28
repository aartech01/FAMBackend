import nodemailer from "nodemailer";
import { Resend } from "resend";

// Resend client (used in production when RESEND_API_KEY is set)
const resendClient = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Nodemailer transporter (used in local dev as fallback)
// const transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com",
//   port: 587,
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send email (generic function)
export const sendEmail = async (to, subject, htmlContent, textContent = null) => {
  try {
    const from = process.env.EMAIL_FROM || `FAM <${process.env.EMAIL_USER}>`;

    if (resendClient) {
      // Production: use Resend (works reliably from Railway)
      const { data, error } = await resendClient.emails.send({
        from,
        to: [to],
        subject,
        html: htmlContent,
        text: textContent || htmlContent.replace(/<[^>]*>/g, ""),
      });
      if (error) {
        console.error("Resend error:", error.message);
        return { success: false, error: error.message };
      }
      console.log(`Email sent via Resend to ${to}: ${data?.id}`);
      return { success: true, messageId: data?.id };
    }

    // Local dev: use nodemailer + Gmail
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return {
        success: false,
        error: "Email service not configured on server. Set RESEND_API_KEY or EMAIL_USER + EMAIL_PASS in environment variables.",
      };
    }
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ""),
    });
    console.log(`Email sent via Gmail to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email sending error:", error.message);
    return { success: false, error: error.message || String(error) };
  }
};

// Send OTP email with beautiful HTML template
export const sendOTPEmail = async (email, otp) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OTP Verification</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 500px;
          margin: 50px auto;
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          overflow: hidden;
          animation: fadeIn 0.5s ease-in;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
        }
        .header h1 {
          font-size: 28px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        .header p {
          font-size: 14px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .otp-code {
          font-size: 52px;
          font-weight: bold;
          color: #667eea;
          letter-spacing: 15px;
          margin: 30px 0;
          padding: 20px;
          background: #f0f0f8;
          border-radius: 15px;
          font-family: 'Courier New', monospace;
          text-align: center;
        }
        .message {
          color: #555;
          line-height: 1.6;
          margin-bottom: 20px;
        }
        .expiry {
          background: #fff3cd;
          color: #856404;
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          margin: 20px 0;
        }
        .footer {
          background: #f8f9fa;
          padding: 25px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #eee;
        }
        .warning {
          color: #dc3545;
          font-size: 13px;
          margin-top: 15px;
          padding: 10px;
          background: #ffe6e6;
          border-radius: 8px;
        }
        .btn {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 25px;
          margin-top: 20px;
          font-weight: 600;
        }
        @media (max-width: 480px) {
          .container { margin: 20px auto; }
          .otp-code { font-size: 36px; letter-spacing: 10px; }
          .header h1 { font-size: 24px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Email Verification</h1>
          <p>FAM</p>
        </div>
        <div class="content">
          <h2 style="color: #333; margin-bottom: 10px;">Your OTP Code</h2>
          <div class="otp-code">${otp}</div>
          <p class="message">
            Thank you for using FAM.<br>
            Please use the verification code below to complete your login.
          </p>
          <div class="expiry">
            ⏰ This OTP is valid for <strong>5 minutes</strong>
          </div>
          <div class="warning">
            ⚠️ <strong>Security Alert:</strong> Never share this OTP with anyone
          </div>
          <div style="margin-top: 30px;">
            <p style="color: #888; font-size: 12px;">
              If you didn't request this, please ignore this email.
            </p>
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} FAM. All rights reserved.</p>
          <p style="margin-top: 10px;">
            <a href="#" style="color: #667eea; text-decoration: none;">Privacy Policy</a> | 
            <a href="#" style="color: #667eea; text-decoration: none;">Terms of Service</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail(email, "🔐 Your OTP Code for FAM Login", html);
};

// Send notification email
export const sendNotificationEmail = async (email, title, message, type = "notification") => {
  const icons = {
    birthday: "🎂",
    anniversary: "💑",
    new_member: "👶",
    event_update: "📅",
    schedule_change: "⏰",
    approval: "✅",
    notification: "🔔",
  };
  
  const icon = icons[type] || icons.notification;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${icon} ${title}</h1>
        </div>
        <div class="content">
          <p style="font-size: 16px; line-height: 1.5;">${message}</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            You received this email because you're a member of FAM.
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} FAM</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail(email, title, html);
};

// Send welcome email
export const sendWelcomeEmail = async (email, username) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to FAM!</h1>
        </div>
        <div class="content">
          <h2>Hello ${username}!</h2>
          <p>Welcome to FAM. We're excited to have you!</p>
          <p>You can now:</p>
          <ul>
            <li>Join family events</li>
            <li>Build your family tree</li>
            <li>Connect with relatives</li>
            <li>Get birthday and anniversary reminders</li>
          </ul>
          <p>Start exploring your family history today!</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail(email, "🎉 Welcome to FAM!", html);
};

// Send organizer credentials email
export const sendOrganizerCredentials = async (email, name, tempPassword, accessCode, eventName) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ff9800 0%, #ffc107 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .credentials { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .credential-item { margin: 10px 0; }
        .label { font-weight: bold; color: #333; }
        .value { font-family: monospace; font-size: 16px; color: #ff9800; }
        .warning { color: #dc3545; font-size: 14px; margin-top: 20px; padding: 10px; background: #ffe6e6; border-radius: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎪 You're now an Organizer!</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>You have been assigned as an organizer for <strong>${eventName}</strong>.</p>
          
          <div class="credentials">
            <h3>Your Login Credentials:</h3>
            <div class="credential-item">
              <span class="label">Email:</span>
              <span class="value">${email}</span>
            </div>
            <div class="credential-item">
              <span class="label">Temporary Password:</span>
              <span class="value">${tempPassword}</span>
            </div>
            <div class="credential-item">
              <span class="label">Access Code:</span>
              <span class="value">${accessCode}</span>
            </div>
          </div>
          
          <div class="warning">
            ⚠️ <strong>Important:</strong> Please change your password after first login!
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail(email, `🎪 Organizer Access for ${eventName}`, html);
};