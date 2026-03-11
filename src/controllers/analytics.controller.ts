import { Request, Response } from "express";
import Property from "../models/property.model.js";
import Admin from "../models/admin.model.js";
import Contact from "../models/contact.js"; // ✅ Correct import
import HomePageLead from "../models/HomePageLead.js";
import RegisterInterest from "../models/RegisterInterest.js";
import EmailMarketing from "../models/EmailMarketing.js";
import Blog from "../models/blog.model.js";
import Testimonial from "../models/testimonial.model.js";
import OffPlan from "../models/OffPlan.js";

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const totalProperties = await Property.countDocuments();
    const totalAdmins = await Admin.countDocuments();
    const totalContacts = await Contact.countDocuments(); // ✅ Correct usage

    const propertiesByStatus = await Property.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const propertiesByType = await Property.aggregate([
      { $group: { _id: "$propertyType", count: { $sum: 1 } } },
    ]);

    const recentProperties = await Property.find()
      .sort({ createdAt: -1 })
      .limit(5);

    const recentContacts = await Contact.find()
      .sort({ createdAt: -1 })
      .limit(5);

    // Monthly registrations for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyAdmins = await Admin.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthlyProperties = await Property.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProperties,
          totalAdmins,
          totalContacts,
        },
        propertiesByStatus,
        propertiesByType,
        recentProperties,
        recentContacts,
        monthlyAdmins,
        monthlyProperties,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard stats",
      error: error.message,
    });
  }
};

export const getPropertyAnalytics = async (req: Request, res: Response) => {
  try {
    const query: any = {};

    const totalProperties = await Property.countDocuments(query);
    const totalViews = await Property.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: "$views" } } },
    ]);

    const totalLikes = await Property.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: "$likes" } } },
    ]);

    const avgPrice = await Property.aggregate([
      { $match: query },
      { $group: { _id: null, avg: { $avg: "$price" } } },
    ]);

    const topProperties = await Property.find(query)
      .sort({ views: -1 })
      .limit(10)
      .select("title views likes price location");

    const propertiesByEmirate = await Property.aggregate([
      { $match: query },
      { $group: { _id: "$location.emirate", count: { $sum: 1 } } },
    ]);

    const priceRanges = await Property.aggregate([
      { $match: query },
      {
        $bucket: {
          groupBy: "$price",
          boundaries: [
            0,
            500000,
            1000000,
            2000000,
            5000000,
            10000000,
            999999999,
          ],
          default: "10M+",
          output: { count: { $sum: 1 } },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProperties,
          totalViews: totalViews[0]?.total || 0,
          totalLikes: totalLikes[0]?.total || 0,
          avgPrice: avgPrice[0]?.avg || 0,
        },
        topProperties,
        propertiesByEmirate,
        priceRanges,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching property analytics",
      error: error.message,
    });
  }
};

export const getAdminActivity = async (req: Request, res: Response) => {
  try {
    const recentLogins = await Admin.find({ lastLogin: { $exists: true } })
      .sort({ lastLogin: -1 })
      .limit(10)
      .select("name email lastLogin");

    const activeAdmins = await Admin.countDocuments({
      lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    res.status(200).json({
      success: true,
      data: {
        recentLogins,
        activeAdmins,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching admin activity",
      error: error.message,
    });
  }
};

/**
 * GET /api/analytics/marketing
 * Get marketing analytics data (visitors, leads, conversion rate, emails sent)
 */
export const getMarketingAnalytics = async (req: Request, res: Response) => {
  try {
    // Validate and sanitize range parameter
    const validRanges = ['Today', 'This Week', 'This Month', 'This Year'];
    const rangeParam = req.query.range as string;
    
    // Sanitize: trim whitespace and use default if empty
    const range = rangeParam?.trim() || "Today";
    
    // Validate range parameter
    if (range && !validRanges.includes(range)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid range parameter',
        validRanges: validRanges,
        provided: range,
      });
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let groupBy: "hour" | "day" | "month";

    switch (range) {
      case "Today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        groupBy = "hour";
        break;
      case "This Week":
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        groupBy = "day";
        break;
      case "This Month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupBy = "day";
        break;
      case "This Year":
        startDate = new Date(now.getFullYear(), 0, 1);
        groupBy = "month";
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
        groupBy = "hour";
    }

    // Get leads from all sources
    const homePageLeads = await HomePageLead.find({
      createdAt: { $gte: startDate },
    }).lean();

    const contacts = await Contact.find({
      createdAt: { $gte: startDate },
    }).lean();

    const registerInterests = await RegisterInterest.find({
      createdAt: { $gte: startDate },
    }).lean();

    const totalLeads =
      homePageLeads.length + contacts.length + registerInterests.length;

    // Estimate visitors (assuming average conversion rate of 12%)
    // If conversion rate is 12%, then visitors = leads / 0.12
    const estimatedConversionRate = 0.12;
    const totalVisitors = Math.round(totalLeads / estimatedConversionRate);

    // Calculate actual conversion rate
    const conversionRate =
      totalVisitors > 0 ? (totalLeads / totalVisitors) * 100 : 0;

    // Get emails sent
    const emailsSent = await EmailMarketing.countDocuments({
      status: "Sent",
      sentAt: { $gte: startDate },
    });

    // Group leads by time period for chart
    const leadsByPeriod: any = {};

    // Process HomePageLeads
    homePageLeads.forEach((lead) => {
      const date = new Date(lead.createdAt);
      let key: string;

      if (groupBy === "hour") {
        key = `${date.getHours()}:00`;
      } else if (groupBy === "day") {
        if (range === "This Week") {
          const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          key = days[date.getDay()];
        } else {
          key = `Day ${date.getDate()}`;
        }
      } else if (groupBy === "month") {
        const months = ["Q1", "Q2", "Q3", "Q4"];
        const quarter = Math.floor(date.getMonth() / 3);
        key = months[quarter];
      } else {
        key = date.toISOString().split("T")[0];
      }

      if (!leadsByPeriod[key]) {
        leadsByPeriod[key] = { leads: 0, visitors: 0 };
      }
      leadsByPeriod[key].leads += 1;
    });

    // Process Contacts
    contacts.forEach((contact) => {
      const date = new Date(contact.createdAt);
      let key: string;

      if (groupBy === "hour") {
        key = `${date.getHours()}:00`;
      } else if (groupBy === "day") {
        if (range === "This Week") {
          const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          key = days[date.getDay()];
        } else {
          key = `Day ${date.getDate()}`;
        }
      } else if (groupBy === "month") {
        const months = ["Q1", "Q2", "Q3", "Q4"];
        const quarter = Math.floor(date.getMonth() / 3);
        key = months[quarter];
      } else {
        key = date.toISOString().split("T")[0];
      }

      if (!leadsByPeriod[key]) {
        leadsByPeriod[key] = { leads: 0, visitors: 0 };
      }
      leadsByPeriod[key].leads += 1;
    });

    // Process RegisterInterests
    registerInterests.forEach((interest) => {
      const date = new Date((interest as any).createdAt);
      let key: string;

      if (groupBy === "hour") {
        key = `${date.getHours()}:00`;
      } else if (groupBy === "day") {
        if (range === "This Week") {
          const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          key = days[date.getDay()];
        } else {
          key = `Day ${date.getDate()}`;
        }
      } else if (groupBy === "month") {
        const months = ["Q1", "Q2", "Q3", "Q4"];
        const quarter = Math.floor(date.getMonth() / 3);
        key = months[quarter];
      } else {
        key = date.toISOString().split("T")[0];
      }

      if (!leadsByPeriod[key]) {
        leadsByPeriod[key] = { leads: 0, visitors: 0 };
      }
      leadsByPeriod[key].leads += 1;
    });

    // Calculate visitors for each period (estimate based on conversion rate)
    Object.keys(leadsByPeriod).forEach((key) => {
      leadsByPeriod[key].visitors = Math.round(
        leadsByPeriod[key].leads / estimatedConversionRate
      );
    });

    // Format visitors data for chart
    const visitorsData = Object.keys(leadsByPeriod)
      .map((key) => ({
        day: key,
        visitors: leadsByPeriod[key].visitors,
        leads: leadsByPeriod[key].leads,
      }))
      .sort((a, b) => {
        // Sort by day/hour/week/month order
        if (range === "Today") {
          return parseInt(a.day.split(":")[0]) - parseInt(b.day.split(":")[0]);
        } else if (range === "This Week") {
          const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          return days.indexOf(a.day) - days.indexOf(b.day);
        } else if (range === "This Month") {
          return parseInt(a.day.split(" ")[1]) - parseInt(b.day.split(" ")[1]);
        } else if (range === "This Year") {
          const quarters = ["Q1", "Q2", "Q3", "Q4"];
          return quarters.indexOf(a.day) - quarters.indexOf(b.day);
        }
        return 0;
      });

    // Conversions by source
    const conversionsData = [
      {
        source: "Home Page",
        conversions: homePageLeads.length,
      },
      {
        source: "Contact Us",
        conversions: contacts.length,
      },
      {
        source: "Register Interest",
        conversions: registerInterests.length,
      },
    ];

    res.status(200).json({
      success: true,
      data: {
        cards: {
          visitors: totalVisitors,
          leads: totalLeads,
          rate: parseFloat(conversionRate.toFixed(1)),
          emails: emailsSent,
        },
        visitorsData,
        conversionsData,
      },
    });
  } catch (error: any) {
    console.error("Error fetching marketing analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching marketing analytics",
      error: error.message,
    });
  }
};

/**
 * GET /api/analytics/language-counts
 * Get language-specific counts for Properties, Blogs, and Testimonials
 * Only counts items that have content in that specific language
 */
export const getLanguageSpecificCounts = async (req: Request, res: Response) => {
  try {
    // Properties - count by language
    const propertiesEn = await Property.countDocuments({
      "title.en": { $exists: true, $ne: "" }
    });
    const propertiesFr = await Property.countDocuments({
      "title.fr": { $exists: true, $ne: "" }
    });
    const propertiesEs = await Property.countDocuments({
      "title.es": { $exists: true, $ne: "" }
    });

    // OffPlans - count by language
    const offPlansEn = await OffPlan.countDocuments({
      "title.en": { $exists: true, $ne: "" }
    });
    const offPlansFr = await OffPlan.countDocuments({
      "title.fr": { $exists: true, $ne: "" }
    });
    const offPlansEs = await OffPlan.countDocuments({
      "title.es": { $exists: true, $ne: "" }
    });

    // Blogs - count by language
    // English: title field exists and is not empty
    const blogsEn = await Blog.countDocuments({
      title: { $exists: true, $ne: "" }
    });
    // French: languages.fr.title exists and is not empty
    const blogsFr = await Blog.countDocuments({
      "languages.fr.title": { $exists: true, $ne: "" }
    });
    // Spanish: languages.es.title exists and is not empty
    const blogsEs = await Blog.countDocuments({
      "languages.es.title": { $exists: true, $ne: "" }
    });

    // Testimonials - count by language
    // English: text field exists and is not empty
    const testimonialsEn = await Testimonial.countDocuments({
      text: { $exists: true, $ne: "" }
    });
    // French: languages.fr.text exists and is not empty
    const testimonialsFr = await Testimonial.countDocuments({
      "languages.fr.text": { $exists: true, $ne: "" }
    });
    // Spanish: languages.es.text exists and is not empty
    const testimonialsEs = await Testimonial.countDocuments({
      "languages.es.text": { $exists: true, $ne: "" }
    });

    res.status(200).json({
      success: true,
      data: {
        properties: {
          en: propertiesEn,
          fr: propertiesFr,
          es: propertiesEs,
        },
        offPlans: {
          en: offPlansEn,
          fr: offPlansFr,
          es: offPlansEs,
        },
        blogs: {
          en: blogsEn,
          fr: blogsFr,
          es: blogsEs,
        },
        testimonials: {
          en: testimonialsEn,
          fr: testimonialsFr,
          es: testimonialsEs,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching language-specific counts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching language-specific counts",
      error: error.message,
    });
  }
};
