import { Router, Request, Response } from "express";
import Subscription from "../models/Subscription.js";
import { protect, restrictToCustomerManager } from "../middleware/auth.middleware.js";
import { createNotification } from "../controllers/notification.controller.js";
import { sendNewsletterSubscriptionEmail } from "../utils/newsletterEmail.util.js";
import { newsletterRateLimiter } from "../middleware/rateLimiter.middleware.js";
import { newsletterValidation, validate } from "../middleware/validation.middleware.js";

const router = Router();

// POST /api/subscribe - Rate limited: 30 requests per day per IP
router.post("/", newsletterRateLimiter, newsletterValidation, validate, async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const existing = await Subscription.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already subscribed" });
    }

    const subscription = await Subscription.create({ email });
    
    // Create notification
    await createNotification(
      "newsletter",
      "created",
      "New Newsletter Subscription",
      `New newsletter subscription from ${email}.`,
      String(subscription._id)
    );
    
    // Send email notification
    await sendNewsletterSubscriptionEmail({
      email,
      subscriptionDate: subscription.createdAt,
    });
    
    return res.status(201).json({ success: true, message: "Subscribed successfully!" });
  } catch (error) {
    console.error("Subscription error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/subscribe - Get all subscriptions (customer-manager only)
router.get("/", protect, restrictToCustomerManager, async (req: Request, res: Response): Promise<Response> => {
  try {
    const subscriptions = await Subscription.find().sort({ createdAt: -1 });
    const count = await Subscription.countDocuments();
    
    return res.status(200).json({ 
      success: true, 
      count,
      data: subscriptions 
    });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /api/subscribe/:id - Delete subscription (customer-manager only)
router.delete("/:id", protect, restrictToCustomerManager, async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const deletedSubscription = await Subscription.findByIdAndDelete(id);

    if (!deletedSubscription) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Subscription deleted successfully",
      data: deletedSubscription 
    });
  } catch (error) {
    console.error("Error deleting subscription:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
