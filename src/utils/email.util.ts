import nodemailer from 'nodemailer';

interface EmailOptions {
  email: string;      // Recipient's email
  subject: string;    // Subject line
  message: string;    // Plain text message
  html?: string;      // Optional HTML body
}

export const sendEmail = async (options: EmailOptions) => {
  try {
    // ✅ Create reusable transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production', // ⚠️ Helps avoid local SSL errors
      },
    });

    // ✅ Define email options
    const mailOptions = {
      from: `${process.env.FROM_NAME || 'Gulf Estates'} <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html || options.message,
    };

    // ✅ Send the email
    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully:', info.messageId);
  } catch (error: any) {
    console.error('❌ Error sending email:', error.message);
    throw new Error(error.message);
  }
};
