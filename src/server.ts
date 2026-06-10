import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import mongoose from "mongoose";
import compression from "compression";
// import rateLimit from "express-rate-limit";

// Routes
import authRoutes from "./routes/auth.routes.js";
import propertyRoutes from "./routes/property.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import favoriteRoutes from "./routes/favorite.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import offPlanRoutes from "./routes/offPlanRoutes.js";
import uploadRoutes from "./routes/upload.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import blogRoutes from "./routes/blog.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import registerInterestRoutes from "./routes/registerInterestRoutes.js";
import seoRoutes from "./routes/seoRoutes.js";
import testimonialRoutes from "./routes/testimonial.routes.js";
import homePageLeadRoutes from "./routes/homePageLead.routes.js";
import emailMarketingRoutes from "./routes/emailMarketing.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import jobRoutes from "./routes/job.routes.js";
import jobApplicationRoutes from "./routes/jobApplication.routes.js";
import sitemapRoutes from "./routes/sitemap.routes.js";
import teamRoutes from "./routes/team.routes.js";
import pagesContentRoutes from "./routes/pagesContent.routes.js";

// Middleware
import { errorHandler } from "./middleware/error.middleware.js";
import { notFound } from "./middleware/notFound.middleware.js";
import { csrfProtection } from "./middleware/csrf.middleware.js";

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// ✅ Type-safe Mongo URI
const MONGO_URI = process.env.MONGO_URI as string;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env file");
  process.exit(1);
}

// Middleware
app.use(helmet());
// CSRF Protection - Check origin for POST/PUT/DELETE requests
app.use(csrfProtection);

const corsUrls = [
  "https://gulfestates.ae",
  "https://www.gulfestates.ae",
  "https://backend.gulfestates.ae",
  "https://admin.gulfestates.ae",
]
if (process.env.NODE_ENV === "development") {
  corsUrls.push("http://localhost:3001", "http://localhost:3000");
}
app.use(
  cors({
    origin: corsUrls,
    credentials: true,
  })
);
app.use(compression());
app.use(morgan("dev"));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Database connection
const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGO_URI);
    const dbName = mongoose.connection.db?.databaseName || mongoose.connection.name || "Unknown";
    const dbHost = mongoose.connection.host || "Unknown";
    console.log("✅ MongoDB connected successfully");
    console.log(`📊 Database: ${dbName} - 🌐 Host: ${dbHost}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Base route
app.get("/", (req, res) => {
  res.json({
    message: "Gulf Estates Backend APIs",
    version: "1.0.1",
    status: "activated",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/seo", seoRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/offplans", offPlanRoutes);
app.use("/api/subscribe", subscriptionRoutes);
app.use("/api/register-interest", registerInterestRoutes);
app.use("/api/testimonials", testimonialRoutes);
app.use("/api/home-page-leads", homePageLeadRoutes);
app.use("/api/email-marketing", emailMarketingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/job-applications", jobApplicationRoutes);
app.use("/api/sitemap", sitemapRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/pages/content", pagesContentRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const startServer = async (): Promise<void> => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  });
};

startServer();

export default app;
