-- Migration 025: Add notification trigger for new reviews
-- Created: December 2025
-- Purpose: Notify venue owners when they receive a new review

-- ============================================================================
-- FUNCTION: Create notification when a new review is submitted
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_venue_owner_of_review()
RETURNS TRIGGER AS $$
DECLARE
  venue_owner_id uuid;
  venue_name text;
  reviewer_name text;
  court_name text;
BEGIN
  -- Get venue owner, venue name, and court name
  SELECT 
    v.owner_id, 
    v.name,
    c.name
  INTO venue_owner_id, venue_name, court_name
  FROM courts c
  JOIN venues v ON c.venue_id = v.id
  WHERE c.id = NEW.court_id;

  -- Only proceed if venue has an owner
  IF venue_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get reviewer's display name
  SELECT display_name INTO reviewer_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Insert notification for venue owner
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    action_url
  ) VALUES (
    venue_owner_id,
    'rating_received',
    'New Review Received',
    CASE 
      WHEN court_name IS NOT NULL THEN
        format('%s left a %s-star review for %s at %s', 
          COALESCE(reviewer_name, 'A guest'), 
          NEW.overall_rating::text, 
          court_name,
          venue_name
        )
      ELSE
        format('%s left a %s-star review for %s', 
          COALESCE(reviewer_name, 'A guest'), 
          NEW.overall_rating::text,
          venue_name
        )
    END,
    format('/court-admin/reviews?venue_id=%s', 
      (SELECT venue_id FROM courts WHERE id = NEW.court_id)
    )
  );

  RAISE LOG 'Created notification for venue owner % about review from %', 
    venue_owner_id, NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Fire notification function after new review insert
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_notify_venue_owner_of_review ON court_ratings;

CREATE TRIGGER trigger_notify_venue_owner_of_review
  AFTER INSERT ON court_ratings
  FOR EACH ROW
  EXECUTE FUNCTION notify_venue_owner_of_review();

COMMENT ON FUNCTION notify_venue_owner_of_review() IS 
  'Creates a notification for the venue owner when a new review is submitted';

COMMENT ON TRIGGER trigger_notify_venue_owner_of_review ON court_ratings IS 
  'Notifies venue owners of new reviews in real-time';
