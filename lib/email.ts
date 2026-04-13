import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_USER) {
    console.log('Email not sent (SMTP not configured):', { to, subject });
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Plus One" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log('Email sent to:', to);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

export const emailTemplates = {
  bookingConfirmation: (name: string, companionName: string, date: string, location: string) => ({
    subject: 'Booking Confirmed - Plus One',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #D4AF37;">Booking Confirmed!</h2>
        <p>Hi ${name},</p>
        <p>Your booking with <strong>${companionName}</strong> has been confirmed.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Location:</strong> ${location}</p>
        </div>
        <p>Please arrive on time. For safety, you can set up check-in reminders in your account.</p>
        <p>Stay safe,<br>Plus One Team</p>
      </div>
    `,
  }),

  newMessage: (name: string, senderName: string) => ({
    subject: 'New Message - Plus One',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #D4AF37;">New Message</h2>
        <p>Hi ${name},</p>
        <p>You have a new message from <strong>${senderName}</strong>.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/chat" style="background: #D4AF37; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0;">View Message</a>
      </div>
    `,
  }),

  safetyCheckIn: (name: string, scheduledTime: string) => ({
    subject: 'Safety Check-In Scheduled - Plus One',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #D4AF37;">Safety Check-In Set</h2>
        <p>Hi ${name},</p>
        <p>You have scheduled a safety check-in for <strong>${scheduledTime}</strong>.</p>
        <p>If you don't check in within 15 minutes of the scheduled time, your emergency contact will be notified.</p>
        <p>Stay safe!</p>
      </div>
    `,
  }),

  paymentReceived: (name: string, amount: string, description: string) => ({
    subject: 'Payment Received - Plus One',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #D4AF37;">Payment Successful</h2>
        <p>Hi ${name},</p>
        <p>We have received your payment of <strong>${amount}</strong> for ${description}.</p>
        <p>Thank you for using Plus One — your social companionship platform!</p>
      </div>
    `,
  }),
};

// ─── Client onboarding emails ─────────────────────────────────────────────────

export async function sendClientApprovedEmail(
  email: string,
  name: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://plusone.app';
  try {
    await sendEmail(
      email,
      'Your application has been approved — Plus One',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1C1C1C; color: #FFFFFF; padding: 40px; border-radius: 12px;">
        <h1 style="color: #D4AF37; font-size: 28px; margin-bottom: 8px;">Welcome to Plus One</h1>
        <p style="color: #A0A0A0; margin-bottom: 24px;">Your application has been approved</p>
        <p>Hi ${name},</p>
        <p>Great news — your application has been reviewed and approved. You can now access the platform and connect with verified social companions for events, dining, and travel.</p>
        <div style="margin: 32px 0;">
          <a href="${appUrl}/client/dashboard"
             style="background: #D4AF37; color: #1C1C1C; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Access Your Dashboard
          </a>
        </div>
        <p style="color: #A0A0A0; font-size: 14px;">If you have any questions, reply to this email and we'll be happy to help.</p>
        <p style="color: #A0A0A0; font-size: 14px;">— The Plus One Team</p>
      </div>
      `
    );
  } catch (err) {
    console.error('sendClientApprovedEmail failed:', err);
  }
}

export async function sendClientRejectedEmail(
  email: string,
  name: string,
  reason: string
): Promise<void> {
  try {
    await sendEmail(
      email,
      'Update on your Plus One application',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1C1C1C; color: #FFFFFF; padding: 40px; border-radius: 12px;">
        <h1 style="color: #D4AF37; font-size: 28px; margin-bottom: 8px;">Application Update</h1>
        <p style="color: #A0A0A0; margin-bottom: 24px;">Plus One</p>
        <p>Hi ${name},</p>
        <p>Thank you for your interest in Plus One. After carefully reviewing your application, we're unable to approve it at this time.</p>
        <div style="background: #2A2A2A; border-left: 3px solid #D4AF37; padding: 16px; border-radius: 4px; margin: 24px 0;">
          <p style="margin: 0; color: #A0A0A0; font-size: 14px;">Reason provided:</p>
          <p style="margin: 8px 0 0; color: #FFFFFF;">${reason}</p>
        </div>
        <p>If you believe this is an error or would like to provide additional information, please contact our support team.</p>
        <p style="color: #A0A0A0; font-size: 14px;">— The Plus One Team</p>
      </div>
      `
    );
  } catch (err) {
    console.error('sendClientRejectedEmail failed:', err);
  }
}

export async function sendCompanionCredentialsEmail(
  email: string,
  name: string,
  tempPassword: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://plusone.app';
  try {
    await sendEmail(
      email,
      'Your Plus One companion account is ready',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1C1C1C; color: #FFFFFF; padding: 40px; border-radius: 12px;">
        <h1 style="color: #D4AF37; font-size: 28px; margin-bottom: 8px;">Welcome, ${name}</h1>
        <p style="color: #A0A0A0; margin-bottom: 24px;">Your companion account has been created</p>
        <p>Your account is ready. Use the credentials below to log in and complete your profile setup.</p>
        <div style="background: #2A2A2A; border-radius: 8px; padding: 24px; margin: 24px 0;">
          <p style="margin: 0 0 8px; color: #A0A0A0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Login URL</p>
          <p style="margin: 0 0 16px; color: #D4AF37;">${appUrl}/login</p>
          <p style="margin: 0 0 8px; color: #A0A0A0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Email</p>
          <p style="margin: 0 0 16px; font-family: monospace; font-size: 16px;">${email}</p>
          <p style="margin: 0 0 8px; color: #A0A0A0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
          <p style="margin: 0; font-family: monospace; font-size: 20px; color: #D4AF37; letter-spacing: 2px;">${tempPassword}</p>
        </div>
        <p style="color: #EF4444; font-size: 14px;">You will be required to change your password on first login.</p>
        <div style="margin: 32px 0;">
          <a href="${appUrl}/login"
             style="background: #D4AF37; color: #1C1C1C; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Log In Now
          </a>
        </div>
        <p style="color: #A0A0A0; font-size: 14px;">Keep this email safe. If you did not expect this account, contact support immediately.</p>
        <p style="color: #A0A0A0; font-size: 14px;">— The Plus One Team</p>
      </div>
      `
    );
  } catch (err) {
    console.error('sendCompanionCredentialsEmail failed:', err);
  }
}

export default transporter;
