import { Request, Response } from 'express';
import Admin from '../models/admin.model.js';

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const allowedFields = ['name', 'phone', 'avatar'];

        const updates: any = {};
        Object.keys(req.body).forEach(key => {
            if (allowedFields.includes(key)) {
                updates[key] = req.body[key];
            }
        });

        const admin = await Admin.findByIdAndUpdate(
            req.admin?.id || req.user?.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                admin: {
                    id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    phone: admin.phone,
                    avatar: admin.avatar,
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const admin = await Admin.findById(req.admin?.id || req.user?.id).select('+password');
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        const isMatch = await admin.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        admin.password = newPassword;
        await admin.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error changing password',
            error: error.message
        });
    }
};

export const getAllAdmins = async (req: Request, res: Response) => {
    try {
        // Only superadmin can view all users
        const currentAdmin = req.admin;
        if (!currentAdmin) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized',
            });
        }

        const role = currentAdmin.role || 'user';
        if (role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only superadmin can view all users.',
            });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const admins = await Admin.find()
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .select('-password');

        const total = await Admin.countDocuments();

        res.status(200).json({
            success: true,
            data: {
                items: admins,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error fetching admins',
            error: error.message
        });
    }
};

export const getAdminById = async (req: Request, res: Response) => {
    try {
        // Only superadmin can view user details
        const currentAdmin = req.admin;
        if (!currentAdmin) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized',
            });
        }

        const role = currentAdmin.role || 'user';
        if (role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only superadmin can view user details.',
            });
        }

        const admin = await Admin.findById(req.params.id).select('-password');

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                admin: {
                    id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    phone: admin.phone,
                    avatar: admin.avatar,
                    role: admin.role || 'user',
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error fetching admin',
            error: error.message
        });
    }
};

export const createAdmin = async (req: Request, res: Response) => {
    try {
        // Only superadmin can create users
        const currentAdmin = req.admin;
        if (!currentAdmin) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized',
            });
        }

        const role = currentAdmin.role || 'user';
        if (role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only superadmin can create users.',
            });
        }

        const { name, email, password, phone, avatar, role: userRole } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required',
            });
        }

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'Admin with this email already exists',
            });
        }

        // Validate role
        const validRoles = ['superadmin', 'admin', 'marketing', 'user'];
        const finalRole = userRole && validRoles.includes(userRole) ? userRole : 'user';

        const admin = await Admin.create({
            name,
            email: email.toLowerCase(),
            password,
            phone,
            avatar,
            role: finalRole,
        });

        res.status(201).json({
            success: true,
            message: 'Admin created successfully',
            data: {
                admin: {
                    id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    phone: admin.phone,
                    avatar: admin.avatar,
                    role: admin.role,
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error creating admin',
            error: error.message
        });
    }
};

export const updateAdmin = async (req: Request, res: Response) => {
    try {
        // Only superadmin can update users
        const currentAdmin = req.admin;
        if (!currentAdmin) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized',
            });
        }

        const role = currentAdmin.role || 'user';
        if (role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only superadmin can update users.',
            });
        }

        const { name, email, phone, avatar, role: userRole } = req.body;
        const allowedFields: any = {};

        if (name) allowedFields.name = name;
        if (email) allowedFields.email = email.toLowerCase();
        if (phone !== undefined) allowedFields.phone = phone;
        if (avatar !== undefined) allowedFields.avatar = avatar;
        if (userRole) {
            const validRoles = ['superadmin', 'admin', 'marketing', 'user'];
            if (validRoles.includes(userRole)) {
                allowedFields.role = userRole;
            }
        }

        const admin = await Admin.findByIdAndUpdate(
            req.params.id,
            allowedFields,
            { new: true, runValidators: true }
        ).select('-password');

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Admin updated successfully',
            data: {
                admin: {
                    id: admin._id,
                    name: admin.name,
                    email: admin.email,
                    phone: admin.phone,
                    avatar: admin.avatar,
                    role: admin.role,
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Error updating admin',
            error: error.message
        });
    }
};

