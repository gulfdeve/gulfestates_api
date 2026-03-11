import express from 'express';
import {
  updateProfile,
  changePassword,
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin
} from '../controllers/admin.controller.js';
import { protect, restrictToAdmin, restrictToSuperAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.get('/', protect, restrictToSuperAdmin, getAllAdmins);
router.get('/:id', protect, restrictToSuperAdmin, getAdminById);
router.post('/', protect, restrictToSuperAdmin, createAdmin);
router.put('/:id', protect, restrictToSuperAdmin, updateAdmin);

export default router;

