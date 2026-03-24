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
        <p>Thank you for choosing Plus One!</p>
      </div>
    `,
  }),
};

export default transporter;
