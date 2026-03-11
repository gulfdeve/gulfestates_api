// routes/sitemap.routes.ts
import express from "express";
import { getSitemapSlugs } from "../controllers/sitemap.controller.js";

const router = express.Router();

router.get("/slugs", getSitemapSlugs);

export default router;

