// User & Auth Types
export interface User {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  id: string;
  userId: string;
  role: Role;
  createdAt: Date;
}

export type Role = 'player' | 'court_admin' | 'queue_master' | 'global_admin';

// Player Types
export interface Player {
  id: string;
  userId: string;
  skillLevel: number; // 1-10
  eloRating: number; // starts at 1500
  wins: number;
  losses: number;
  gamesPlayed: number;
  preferredPlayStyle?: PlayStyle;
  createdAt: Date;
  updatedAt: Date;
}

export type PlayStyle = 'singles' | 'doubles' | 'mixed' | 'all';

// Venue & Court Types
export interface Venue {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  phone?: string;
  email?: string;
  website?: string;
  imageUrl?: string;
  isActive: boolean;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Court {
  id: string;
  venueId: string;
  name: string;
  description?: string;
  courtType: CourtType;
  surfaceType: SurfaceType;
  isIndoor: boolean;
  capacity: number;
  hourlyRate: number;
  isActive: boolean;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CourtType = 'standard' | 'professional' | 'training';
export type SurfaceType = 'wood' | 'synthetic' | 'concrete' | 'rubber';

export interface CourtAmenity {
  id: string;
  name: string;
  icon?: string;
}

// Availability & Reservation Types
export interface CourtAvailability {
  id: string;
  courtId: string;
  dayOfWeek: number; // 0-6, Sunday = 0
  startTime: string; // HH:mm format
  endTime: string;
  isAvailable: boolean;
}

export interface Reservation {
  id: string;
  courtId: string;
  userId: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  totalAmount: number;
  paidAmount: number;
  paymentDeadline?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

// Queue Types
export interface QueueSession {
  id: string;
  courtId: string;
  createdBy: string;
  name: string;
  status: QueueStatus;
  maxParticipants: number;
  currentParticipants: number;
  startTime: Date;
  endTime?: Date;
  settings: QueueSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type QueueStatus = 'waiting' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface QueueSettings {
  skillBalancing: boolean;
  autoRotate: boolean;
  gamesPerRotation: number;
  allowLateJoin: boolean;
}

export interface QueueParticipant {
  id: string;
  queueSessionId: string;
  playerId: string;
  joinedAt: Date;
  status: ParticipantStatus;
  position: number;
  gamesPlayed: number;
}

export type ParticipantStatus = 'waiting' | 'playing' | 'resting' | 'left';

// Payment Types
export interface Payment {
  id: string;
  reservationId?: string;
  queueSessionId?: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  externalId?: string; // PayMongo transaction ID
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentMethod = 'gcash' | 'maya' | 'card' | 'cash' | 'qr_code';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

// Rating Types
export interface CourtRating {
  id: string;
  courtId: string;
  userId: string;
  overallRating: number; // 1-5
  qualityRating?: number;
  cleanlinessRating?: number;
  facilitiesRating?: number;
  valueRating?: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerRating {
  id: string;
  raterId: string;
  ratedPlayerId: string;
  sportsmanshipRating: number; // 1-5
  skillRating: number;
  reliabilityRating: number;
  comment?: string;
  matchId?: string;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Search & Filter Types
export interface CourtSearchParams {
  latitude?: number;
  longitude?: number;
  radius?: number; // in kilometers
  city?: string;
  courtType?: CourtType;
  surfaceType?: SurfaceType;
  isIndoor?: boolean;
  minPrice?: number;
  maxPrice?: number;
  amenities?: string[];
  date?: Date;
  startTime?: string;
  endTime?: string;
}

export interface VenueWithCourts extends Venue {
  courts: Court[];
  distance?: number; // in kilometers
  averageRating?: number;
  totalReviews?: number;
}
