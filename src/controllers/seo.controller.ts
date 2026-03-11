import { Request, Response } from "express";
import propertyModel from "../models/property.model.js";
import blogModel from "../models/blog.model.js";
import OffPlan from "../models/OffPlan.js";

// ✅ Get All Seo Data
export const GetAllSeoData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { slug, type } = req.query;

    if (!slug || !type) {
      res
        .status(400)
        .json({ success: false, message: "Slug and type are required" });
      return;
    }
    let seoData: any;

    if (type === "property") {
      const property: any = await propertyModel
        .findOne({ _id: slug })
        .select("seo title image");
      if (!property) {
        res.status(404).json({ success: false, message: "Property not found" });
        return;
      }
      seoData = {
        ...property?.seo,
        title: property?.title,
        image: property?.image,
        schema: property?.seo?.schema || null, // Explicitly include schema
      };
    } else if (type === "blog") {
      const blog: any = await blogModel
        .findOne({ slug })
        .select("seo title image excerpt");
      if (!blog) {
        res.status(404).json({ success: false, message: "Blog not found" });
        return;
      }
      seoData = {
        ...blog?.seo,
        title: blog?.title,
        image: blog?.image,
        description: blog?.excerpt,
        schema: blog?.seo?.schema || null, // Explicitly include schema
      };
    } else if (type === "offPlan") {
      const offPlan: any = await OffPlan.findOne({ _id: slug }).select(
        "seo title image"
      );
      if (!offPlan) {
        res.status(404).json({ success: false, message: "OffPlan not found" });
        return;
      }
      seoData = {
        ...offPlan?.seo,
        title: offPlan?.title,
        image: offPlan?.image,
        schema: offPlan?.seo?.schema || null, // Explicitly include schema
      };
    }

    if (!seoData) {
      res.status(404).json({ success: false, message: "Seo data not found" });
      return;
    }

    res.status(200).json({
      success: true,
      data: seoData,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching seo data",
      error: error.message,
    });
  }
};
