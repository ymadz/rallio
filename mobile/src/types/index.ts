// Re-export shared types
export * from '@rallio/shared';

// Mobile-specific types
export interface NavigationParams {
  CourtDetails: { courtId: string };
  ReservationDetails: { reservationId: string };
  QueueSession: { sessionId: string };
  Profile: { userId?: string };
}

export type RootStackParamList = {
  '(tabs)': undefined;
  '(auth)': undefined;
  modal: undefined;
} & NavigationParams;
