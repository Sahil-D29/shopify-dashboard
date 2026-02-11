import { z } from 'zod';

// Segment validation
export const CreateSegmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  filters: z.object({
    conditions: z.array(z.any()).min(1, 'At least one condition required'),
    logic: z.enum(['AND', 'OR']),
  }),
});

export const UpdateSegmentSchema = CreateSegmentSchema.partial();

// Campaign validation
export const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  segmentId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  type: z.enum(['sms', 'email', 'whatsapp']).optional(),
});

export const UpdateCampaignSchema = CreateCampaignSchema.partial();

// Journey validation
export const CreateJourneySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  nodes: z.array(z.any()).min(1, 'At least one node required'),
  edges: z.array(z.any()),
  isActive: z.boolean().optional(),
});

export const UpdateJourneySchema = CreateJourneySchema.partial();

// Auth validation
export const SignInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

export const SignUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Store validation
export const StoreConfigSchema = z.object({
  shop: z.string().min(1, 'Shop domain is required'),
  accessToken: z.string().min(1, 'Access token is required'),
  scope: z.string().optional(),
});


