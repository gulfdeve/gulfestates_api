import express from "express";
import { GetAllSeoData } from "../controllers/seo.controller.js";

const router = express.Router();

router.get("/", GetAllSeoData);

export default router;
