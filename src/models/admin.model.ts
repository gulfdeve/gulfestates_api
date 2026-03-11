import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAdmin extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatar?: string;
  role?: 'superadmin' | 'admin' | 'customer-manager' | 'user';
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const adminSchema = new Schema<IAdmin>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
      validate: {
        validator: function(v: string) {
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(v);
        },
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
      },    
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[\d\+\-\s\(\)]+$/, 'Please provide a valid phone number'],
    },
    avatar: {
      type: String,
      default: 'https://via.placeholder.com/150',
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'customer-manager', 'user'],
      default: 'user',
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLogin: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ✅ Hash password before saving
adminSchema.pre<IAdmin>('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ✅ Compare password
adminSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IAdmin>('Admin', adminSchema);

