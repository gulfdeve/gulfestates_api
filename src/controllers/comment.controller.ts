import { Request, Response } from "express";
import Comment from "../models/comment.model.js";
import Blog from "../models/blog.model.js";
import mongoose from "mongoose";

// Create comment (public - no auth required)
export const createComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { comment, name, email, saveInfo, blog } = req.body;

    if (!comment || !name || !email || !blog) {
      res.status(400).json({
        success: false,
        message: "Comment, name, email, and blog are required.",
      });
      return;
    }

    // Validate blog exists
    const blogExists = await Blog.findById(blog);
    if (!blogExists) {
      res.status(404).json({
        success: false,
        message: "Blog not found.",
      });
      return;
    }

    const newComment = await Comment.create({
      blog,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      comment: comment.trim(),
      saveInfo: !!saveInfo,
      approved: false,
    });

    res.status(201).json({
      success: true,
      message: "Comment submitted successfully. It will appear after approval.",
      data: newComment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error submitting comment",
      error: error.message,
    });
  }
};

// Get all comments (admin - with blog populate)
export const getAllComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const comments = await Comment.find()
      .populate("blog", "title slug")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching comments",
      error: error.message,
    });
  }
};

// Get approved comments for a blog (public - no auth)
export const getApprovedCommentsByBlog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { blog } = req.query;

    if (!blog || typeof blog !== "string") {
      res.status(400).json({
        success: false,
        message: "Blog ID is required.",
      });
      return;
    }

    const comments = await Comment.find({ blog, approved: true })
      .sort({ createdAt: 1 })
      .select("name comment createdAt")
      .lean();

    res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching comments",
      error: error.message,
    });
  }
};

// Approve comment
export const approveComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid comment ID." });
      return;
    }

    const comment = await Comment.findByIdAndUpdate(
      id,
      { approved: true },
      { new: true }
    ).populate("blog", "title slug");

    if (!comment) {
      res.status(404).json({ success: false, message: "Comment not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Comment approved successfully.",
      data: comment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error approving comment",
      error: error.message,
    });
  }
};

// Delete comment
export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid comment ID." });
      return;
    }

    const comment = await Comment.findByIdAndDelete(id);

    if (!comment) {
      res.status(404).json({ success: false, message: "Comment not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully.",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error deleting comment",
      error: error.message,
    });
  }
};
