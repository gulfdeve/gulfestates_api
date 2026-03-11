import express from "express";
import {
  createRegisterInterest,
  getAllRegisterInterests,
} from "../controllers/registerInterestController.js";

const router = express.Router();

router.post("/", createRegisterInterest);
router.get("/", getAllRegisterInterests);

export default router;
