import * as mongoose from 'mongoose';
import { Role } from '@/common/role.enum';

export const USER_MODEL_NAME = 'User';

const validateEmail = (email) => {
  const regex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return regex.test(email);
};

export const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Please enter your email'],
      validate: [validateEmail, 'Please enter a valid email'],
      unique: true,
    },
    password: {
      type: String,
      required: [true, 'Please enter your password'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    age: {
      type: Number,
      required: [true, 'Please enter your age'],
      min: [0, 'Age should be greater than or equal to 0'],
    },
    role: {
      type: String,
      enum: {
        values: Object.values(Role),
        message: '{VALUE} is not supported for the role',
      },
      default: Role.Customer,
    },
  },
  { timestamps: true },
);

export interface User extends mongoose.Document {
  id: string;
  email: string;
  password: string;
  age: number;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}