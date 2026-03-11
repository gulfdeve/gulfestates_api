import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

interface ContactData {
  name: string;
  email: string;
  countryCode: string;
  phone: string;
  message: string;
}

export const sendContactNotificationEmail = async (contactData: ContactData) => {
  const smtpConfig = {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false, // ⚠️ Helps avoid local SSL errors
    },
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>New Contact Form Submission</title></head>
    <body style="font-family: Arial; margin:0; padding:20px; background:#f4f4f4;">
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${contactData.name}</p>
      <p><strong>Email:</strong> ${contactData.email}</p>
      <p><strong>Phone:</strong> ${contactData.countryCode} ${contactData.phone}</p>
      <p><strong>Message:</strong><br>${contactData.message}</p>
      <p style="color:#999;">© ${new Date().getFullYear()} Gulf Estates</p>
    </body>
    </html>
  `;

  const textContent = `
New Contact Form Submission:

Name: ${contactData.name}
Email: ${contactData.email}
Phone: ${contactData.countryCode} ${contactData.phone}
Message: ${contactData.message}
  `;

  const mailOptions = {
    from: `Gulf Estates Contact Form <info@gulfestates.ae>`,
    to: "info@gulfestates.ae",
    subject: `New Contact Form Submission from ${contactData.name}`,
    text: textContent,
    html: htmlContent,
  };

  try {
    console.log(`🔄 Attempting SMTP on mail.gulfestates.ae:587...`);

    const transporter = nodemailer.createTransport(smtpConfig);
    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
  } catch (error: any) {
    console.error("❌ SMTP ERROR:", error.message);

    if (error.message.includes("535")) {
      console.error("⚠️ Authentication failed — password is incorrect.");
    }

    if (error.message.includes("connect") || error.message.includes("timeout")) {
      console.error("⚠️ Connection timeout — port 587 may be blocked.");
    }
  }
};
