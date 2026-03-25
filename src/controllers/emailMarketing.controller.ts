import { Request, Response } from "express";
import EmailMarketing from "../models/EmailMarketing.js";
import HomePageLead from "../models/HomePageLead.js";
import Contact from "../models/contact.js";
import Subscription from "../models/Subscription.js";
import { sendEmail } from "../utils/email.util.js";

/**
 * Validate email address format
 */
const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false; // RFC 5321 limit
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Check daily email sending limit for admin
 */
const checkDailyEmailLimit = async (adminId: string): Promise<{ allowed: boolean; count: number; limit: number }> => {
  const DAILY_LIMIT = 10000; // Max 10,000 emails per admin per day
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  
  // Count emails sent today by this admin
  const count = await EmailMarketing.countDocuments({
    status: 'Sent',
    sentAt: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    // Note: We need to track adminId in EmailMarketing model for this to work
    // For now, we'll use a simpler approach: count total recipients in campaigns sent today
  });
  
  // Calculate total recipients sent today
  const campaignsToday = await EmailMarketing.find({
    status: 'Sent',
    sentAt: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  }).select('recipients').lean();
  
  const totalRecipientsToday = campaignsToday.reduce((total, campaign) => {
    return total + (campaign.recipients?.length || 0);
  }, 0);
  
  return {
    allowed: totalRecipientsToday < DAILY_LIMIT,
    count: totalRecipientsToday,
    limit: DAILY_LIMIT
  };
};

/**
 * Sleep/delay function for rate limiting
 */
const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generate HTML email template
 */
const generateEmailHTML = (message: string, imageUrl?: string, ctaLink?: string): string => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Campaign</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Gulf Estates</h1>
                </td>
              </tr>
              
              <!-- Image -->
              ${imageUrl ? `
              <tr>
                <td style="padding: 20px; text-align: center;">
                  <img src="${imageUrl}" alt="Campaign Image" style="max-width: 100%; height: auto; border-radius: 8px;" />
                </td>
              </tr>
              ` : ''}
              
              <!-- Message Content -->
              <tr>
                <td style="padding: 30px; color: #333333; line-height: 1.6; font-size: 16px;">
                  ${message.replace(/\n/g, '<br>')}
                </td>
              </tr>
              
              <!-- CTA Button -->
              ${ctaLink ? `
              <tr>
                <td style="padding: 0 30px 30px 30px; text-align: center;">
                  <a href="${ctaLink}" style="display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Learn More</a>
                </td>
              </tr>
              ` : ''}
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #666666; font-size: 14px;">
                  <p style="margin: 0;">© ${new Date().getFullYear()} Gulf Estates. All rights reserved.</p>
                  <p style="margin: 10px 0 0 0;">You are receiving this email because you subscribed to our services.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * GET /api/email-marketing/recipients
 * Get recipients based on audience type
 */
export const getRecipients = async (req: Request, res: Response) => {
    try {
        const { audience } = req.query;

        if (!audience || typeof audience !== "string") {
            return res.status(400).json({
                success: false,
                message: "Audience type is required",
            });
        }

        let recipients: { email: string; name?: string }[] = [];

        switch (audience) {
            case "Home Page Leads":
                const homePageLeads = await HomePageLead.find({}).select("email fullName").lean();
                recipients = homePageLeads.map((lead) => ({
                    email: lead.email,
                    name: lead.fullName,
                }));
                break;

            case "Contact Us":
                const contacts = await Contact.find({}).select("email name").lean();
                recipients = contacts.map((contact) => ({
                    email: contact.email,
                    name: contact.name,
                }));
                break;

            case "Newsletter":
                const subscriptions = await Subscription.find({}).select("email").lean();
                recipients = subscriptions.map((sub) => ({
                    email: sub.email,
                }));
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid audience type",
                });
        }

        res.status(200).json({
            success: true,
            data: recipients,
            count: recipients.length,
        });
    } catch (error: any) {
        console.error("Error fetching recipients:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching recipients",
            error: error.message,
        });
    }
};

/**
 * POST /api/email-marketing
 * Create and send email campaign
 */
export const createEmailCampaign = async (req: Request, res: Response) => {
    try {
        let { title, audience, recipients, emailTitle, message, ctaLink, scheduledAt } = req.body;

        // Parse recipients if it's a string
        if (typeof recipients === "string") {
            try {
                recipients = JSON.parse(recipients);
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid recipients format",
                });
            }
        }

        // Validate required fields
        if (!title || !audience || !recipients || !Array.isArray(recipients) || recipients.length === 0 || !emailTitle || !message) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: title, audience, recipients, emailTitle, message",
            });
        }

        // Validate audience
        if (!["Home Page Leads", "Contact Us", "Newsletter"].includes(audience)) {
            return res.status(400).json({
                success: false,
                message: "Invalid audience type",
            });
        }

        // Store original count for reporting
        const originalRecipientsCount = recipients.length;

        // Validate and sanitize recipients
        const validRecipients = recipients
            .filter((email: any) => {
                // Handle both string emails and objects with email property
                const emailAddress = typeof email === 'string' ? email : email.email || email;
                return isValidEmail(emailAddress);
            })
            .map((email: any) => {
                // Normalize to string format
                return typeof email === 'string' ? email.trim().toLowerCase() : (email.email || email).trim().toLowerCase();
            })
            .filter((email: string, index: number, self: string[]) => {
                // Remove duplicates
                return self.indexOf(email) === index;
            });

        // Check if we have valid recipients
        if (validRecipients.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid email addresses provided. Please ensure all recipient emails are valid.",
            });
        }

        // Limit number of recipients per campaign
        const MAX_RECIPIENTS_PER_CAMPAIGN = 1000;
        if (validRecipients.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
            return res.status(400).json({
                success: false,
                message: `Maximum ${MAX_RECIPIENTS_PER_CAMPAIGN} recipients allowed per campaign. You provided ${validRecipients.length} recipients.`,
            });
        }
        // Handle image upload
        let imageUrl = "";
        if (req.file) {
            // With multer-storage-cloudinary, file.path is already the Cloudinary URL
            imageUrl = req.file.path;
        } else if (req.body.image) {
            // If image is already a URL (from frontend)
            imageUrl = req.body.image;
        }

        // Determine status
        const status = scheduledAt ? "Scheduled" : "Sent";
        const sentAt = scheduledAt ? undefined : new Date();

        // Create email campaign
        const campaign = await EmailMarketing.create({
            title,
            audience,
            recipients: validRecipients, // Use validated recipients
            emailTitle,
            message,
            ctaLink,
            image: imageUrl || undefined,
            status,
            sentAt,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        });

        // Send emails to all recipients
        if (status === "Sent" && !scheduledAt) {
            const emailHTML = generateEmailHTML(message, imageUrl || undefined, ctaLink);
            let successCount = 0;
            let failCount = 0;
            const failedEmails: string[] = [];

            // Send emails with rate limiting (100ms delay between emails)
            const EMAIL_DELAY_MS = 100; // 100ms delay between emails
            const BATCH_SIZE = 10; // Process 10 emails at a time

            // Process emails in batches to avoid overwhelming SMTP server
            for (let i = 0; i < validRecipients.length; i += BATCH_SIZE) {
                const batch = validRecipients.slice(i, i + BATCH_SIZE);
                
                // Send batch of emails
                const batchPromises = batch.map(async (email: string, index: number) => {
                    // Add delay between emails in batch
                    if (index > 0) {
                        await delay(EMAIL_DELAY_MS);
                    }
                    
                    try {
                        await sendEmail({
                            email: email,
                            subject: emailTitle,
                            message: message,
                            html: emailHTML,
                        });
                        successCount++;
                        console.log(`✅ Email sent to: ${email} (${successCount}/${validRecipients.length})`);
                    } catch (error: any) {
                        failCount++;
                        failedEmails.push(email);
                        console.error(`❌ Failed to send email to ${email}:`, error.message);
                    }
                });

                // Wait for batch to complete
                await Promise.allSettled(batchPromises);
                
                // Add delay between batches (except for the last batch)
                if (i + BATCH_SIZE < validRecipients.length) {
                    await delay(EMAIL_DELAY_MS * 2); // Longer delay between batches
                }
            }

            // Update campaign status based on results
            if (failCount > 0 && successCount === 0) {
                campaign.status = "Failed";
                await campaign.save();
            } else if (failCount > 0) {
                // Partial success - keep as "Sent" but log failures
                console.warn(`⚠️ Campaign partially sent: ${successCount} succeeded, ${failCount} failed`);
            }

            res.status(201).json({
                success: true,
                message: `Email campaign ${successCount > 0 ? 'sent' : 'failed'}. ${successCount} email(s) sent successfully${failCount > 0 ? `, ${failCount} failed` : ''}.`,
                data: campaign,
                stats: {
                    total: validRecipients.length,
                    success: successCount,
                    failed: failCount,
                    failedEmails: failedEmails.length > 0 ? failedEmails : undefined,
                    invalidEmailsRemoved: originalRecipientsCount - validRecipients.length,
                },
            });
        } else {
            // Scheduled campaign - don't send yet
            res.status(201).json({
                success: true,
                message: `Email campaign scheduled successfully. ${validRecipients.length} email(s) will be sent at the scheduled time.`,
                data: campaign,
                stats: {
                    total: validRecipients.length,
                    invalidEmailsRemoved: originalRecipientsCount - validRecipients.length,
                },
            });
        }
    } catch (error: any) {
        console.error("Error creating email campaign:", error);
        res.status(500).json({
            success: false,
            message: "Error creating email campaign",
            error: error.message,
        });
    }
};

/**
 * GET /api/email-marketing
 * Get all email campaigns
 */
export const getAllCampaigns = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 50, audience, status } = req.query;

        const query: any = {};
        if (audience) {
            query.audience = audience;
        }
        if (status) {
            query.status = status;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const campaigns = await EmailMarketing.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const total = await EmailMarketing.countDocuments(query);

        // Transform data to include individual recipient records
        const transformedCampaigns: any[] = [];
        campaigns.forEach((campaign: any) => {
            const campaignId = String(campaign._id);
            (campaign.recipients as string[]).forEach((email: string) => {
                transformedCampaigns.push({
                    id: `${campaignId}-${email}`,
                    campaignId: campaignId,
                    email,
                    audience: campaign.audience,
                    title: campaign.emailTitle,
                    status: campaign.status,
                    sentDate: campaign.sentAt || campaign.createdAt,
                    campaignTitle: campaign.title,
                });
            });
        });

        res.status(200).json({
            success: true,
            data: transformedCampaigns,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error: any) {
        console.error("Error fetching campaigns:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching campaigns",
            error: error.message,
        });
    }
};

/**
 * GET /api/email-marketing/:id
 * Get single email campaign
 */
export const getCampaignById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const campaign = await EmailMarketing.findById(id).lean();

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found",
            });
        }

        res.status(200).json({
            success: true,
            data: campaign,
        });
    } catch (error: any) {
        console.error("Error fetching campaign:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching campaign",
            error: error.message,
        });
    }
};

/**
 * DELETE /api/email-marketing/:id
 * Delete email campaign
 */
export const deleteCampaign = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const campaign = await EmailMarketing.findByIdAndDelete(id);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Campaign deleted successfully",
        });
    } catch (error: any) {
        console.error("Error deleting campaign:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting campaign",
            error: error.message,
        });
    }
};

