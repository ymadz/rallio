import { z } from 'zod';

// Auth Validations
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Profile Validations
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const updatePlayerSchema = z.object({
  skillLevel: z.number().min(1).max(10).optional(),
  preferredPlayStyle: z.enum(['singles', 'doubles', 'mixed', 'all']).optional(),
});

// Venue & Court Validations
export const createVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required').max(100),
  description: z.string().max(500).optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
});

export const createCourtSchema = z.object({
  venueId: z.string().uuid(),
  name: z.string().min(1, 'Court name is required').max(50),
  description: z.string().max(500).optional(),
  courtType: z.enum(['standard', 'professional', 'training']),
  surfaceType: z.enum(['wood', 'synthetic', 'concrete', 'rubber']),
  isIndoor: z.boolean(),
  capacity: z.number().min(2).max(20),
  hourlyRate: z.number().min(0),
});

// Reservation Validations
export const createReservationSchema = z.object({
  courtId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:mm)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:mm)'),
  notes: z.string().max(500).optional(),
});

// Queue Validations
export const createQueueSessionSchema = z.object({
  courtId: z.string().uuid(),
  name: z.string().min(1).max(100),
  maxParticipants: z.number().min(4).max(50),
  startTime: z.string().datetime(),
  settings: z.object({
    skillBalancing: z.boolean().default(true),
    autoRotate: z.boolean().default(true),
    gamesPerRotation: z.number().min(1).max(5).default(1),
    allowLateJoin: z.boolean().default(true),
  }),
});

// Rating Validations
export const createCourtRatingSchema = z.object({
  courtId: z.string().uuid(),
  overallRating: z.number().min(1).max(5),
  qualityRating: z.number().min(1).max(5).optional(),
  cleanlinessRating: z.number().min(1).max(5).optional(),
  facilitiesRating: z.number().min(1).max(5).optional(),
  valueRating: z.number().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

export const createPlayerRatingSchema = z.object({
  ratedPlayerId: z.string().uuid(),
  sportsmanshipRating: z.number().min(1).max(5),
  skillRating: z.number().min(1).max(5),
  reliabilityRating: z.number().min(1).max(5),
  comment: z.string().max(500).optional(),
  matchId: z.string().uuid().optional(),
});

// Search Validations
export const courtSearchSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radius: z.number().min(0.1).max(100).optional(), // km
  city: z.string().optional(),
  courtType: z.enum(['standard', 'professional', 'training']).optional(),
  surfaceType: z.enum(['wood', 'synthetic', 'concrete', 'rubber']).optional(),
  isIndoor: z.boolean().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

// Type exports from schemas
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;
export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type CreateCourtInput = z.infer<typeof createCourtSchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type CreateQueueSessionInput = z.infer<typeof createQueueSessionSchema>;
export type CreateCourtRatingInput = z.infer<typeof createCourtRatingSchema>;
export type CreatePlayerRatingInput = z.infer<typeof createPlayerRatingSchema>;
export type CourtSearchInput = z.infer<typeof courtSearchSchema>;
