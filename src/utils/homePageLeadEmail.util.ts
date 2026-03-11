import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

interface HomePageLeadData {
  fullName: string;
  email: string;
  phoneNumber: string;
  country: string;
  countryCode: string;
  budget?: string;
  propertyType?: string;
  consent?: boolean;
  submissionDate?: Date;
}

export const sendHomePageLeadEmail = async (leadData: HomePageLeadData) => {
  // SMTP configuration
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

  const submissionDate = leadData.submissionDate || new Date();
  const formattedDate = submissionDate.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Homepage Lead</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f4;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #01366F 0%, #0E4076 50%, #214F81 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                    🏠 New Homepage Lead
                  </h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                    A new lead has submitted an enquiry through the homepage popup form!
                  </p>
                  
                  <div style="background-color: #f8f9fa; border-left: 4px solid #DEB66A; padding: 20px; margin: 25px 0; border-radius: 4px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #01366F; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Full Name:</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0 15px 0;">
                          <span style="color: #01366F; font-size: 18px; font-weight: 600;">${leadData.fullName}</span>
                        </td>
                      </tr>
                      
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #01366F; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Email Address:</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0 15px 0;">
                          <a href="mailto:${leadData.email}" style="color: #01366F; font-size: 16px; font-weight: 600; text-decoration: none;">
                            ${leadData.email}
                          </a>
                        </td>
                      </tr>
                      
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #01366F; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Phone Number:</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0 15px 0;">
                          <a href="tel:${leadData.countryCode}${leadData.phoneNumber}" style="color: #01366F; font-size: 16px; font-weight: 600; text-decoration: none;">
                            ${leadData.countryCode} ${leadData.phoneNumber}
                          </a>
                        </td>
                      </tr>
                      
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #01366F; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Country:</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0 15px 0;">
                          <span style="color: #666666; font-size: 16px;">${leadData.country}</span>
                        </td>
                      </tr>
                      
                      ${leadData.budget && leadData.budget !== "Select Budget" ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #01366F; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Budget:</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0 15px 0;">
                          <span style="color: #666666; font-size: 16px;">${leadData.budget}</span>
                        </td>
                      </tr>
                      ` : ''}
                      
                      ${leadData.propertyType && leadData.propertyType !== "Property Type" ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #01366F; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Property Type:</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0 15px 0;">
                          <span style="color: #666666; font-size: 16px;">${leadData.propertyType}</span>
                        </td>
                      </tr>
                      ` : ''}
                      
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #01366F; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Newsletter Consent:</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0 15px 0;">
                          <span style="color: #666666; font-size: 16px;">${leadData.consent ? "✅ Yes" : "❌ No"}</span>
                        </td>
                      </tr>
                      
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #01366F; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Submission Date:</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0;">
                          <span style="color: #666666; font-size: 16px;">${formattedDate}</span>
                        </td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © ${new Date().getFullYear()} Gulf Estates. All rights reserved.
                  </p>
                  <p style="margin: 10px 0 0 0; color: #999999; font-size: 12px;">
                    This is an automated notification from the Gulf Estates homepage lead system.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const textContent = `
New Homepage Lead

A new lead has submitted an enquiry through the homepage popup form!

Full Name: ${leadData.fullName}
Email Address: ${leadData.email}
Phone Number: ${leadData.countryCode} ${leadData.phoneNumber}
Country: ${leadData.country}
${leadData.budget && leadData.budget !== "Select Budget" ? `Budget: ${leadData.budget}\n` : ''}${leadData.propertyType && leadData.propertyType !== "Property Type" ? `Property Type: ${leadData.propertyType}\n` : ''}Newsletter Consent: ${leadData.consent ? "Yes" : "No"}
Submission Date: ${formattedDate}

© ${new Date().getFullYear()} Gulf Estates. All rights reserved.
This is an automated notification from the Gulf Estates homepage lead system.
  `;

  const mailOptions = {
    from: `Gulf Estates Homepage Leads <leads@gulfestates.ae>`,
    to: "info@gulfestates.ae",
    subject: `🏠 New Homepage Lead: ${leadData.fullName}`,
    text: textContent,
    html: htmlContent,
  };

  try {
    console.log(
      `🔄 Sending homepage lead notification to leads@gulfestates.ae...`
    );

    const transporter = nodemailer.createTransport(smtpConfig);
    const info = await transporter.sendMail(mailOptions);

    console.log(
      `✅ Homepage lead email sent successfully! Message ID: ${info.messageId}`
    );
  } catch (error: any) {
    console.error("❌ SMTP ERROR:", error.message);

    if (error.message.includes("535")) {
      console.error("⚠️ Authentication failed — password is incorrect.");
    }

    if (
      error.message.includes("connect") ||
      error.message.includes("timeout")
    ) {
      console.error("⚠️ Connection timeout — port 587 may be blocked.");
    }

    // Don't throw error to prevent breaking the lead creation flow
    // Just log it for monitoring
  }
};

