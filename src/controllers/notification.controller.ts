import { Request, Response } from "express";
import Notification from "../models/Notification.js";

/**
 * Helper function to create a notification
 */
export const createNotification = async (
  type: "property" | "blog" | "testimonial" | "contact" | "homepage_lead" | "newsletter" | "delete" | "job" | "job_application",
  action: "created" | "deleted" | "updated",
  title: string,
  message: string,
  relatedId?: string
) => {
  try {
    await Notification.create({
      type,
      action,
      title,
      message,
      relatedId,
      read: false,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

/**
 * GET /api/notifications
 * Get all notifications (with optional filters)
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { read, limit = 50 } = req.query;

    const filter: any = {};
    if (read !== undefined) {
      filter.read = read === "true";
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    const unreadCount = await Notification.countDocuments({ read: false });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message,
    });
  }
};

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking notification as read",
      error: error.message,
    });
  }
};

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    await Notification.updateMany({ read: false }, { read: true });

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking all notifications as read",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting notification",
      error: error.message,
    });
  }
};

