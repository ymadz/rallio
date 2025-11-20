# Booking Process Analysis - Mobile Prototype

**Date**: January 21, 2025
**Source**: Mobile prototype screenshots
**Purpose**: Document booking flow for desktop implementation

---

## 📱 Complete Booking Flow (From Prototype)

### **Step 1: Court Selection & Setup**

**Screen Elements:**
- Progress bar (Step 1 of ~4)
- Court card with:
  - Court name: "Court B - Eagle"
  - Tags: 🏸 Indoor | Synthetic | Doubles
  - Description: "Spacious court ideal for group play and training sessions"
  - Court image
- Detail Breakdown section:
  - Players Allowed to Play: 4
  - Booking Fee: ₱350.00
  - Overall Total: ₱350.00

**Interactive Elements:**
- "Play Together, Pay Together!" toggle switch
  - Description: "Divide the total fee among your group — fair and simple"
  - When OFF: Single payment, full amount
  - When ON: Shows "Add Players" section
    - Text: "Maximum to only allowed players"
    - Player counter: - [3] + buttons
    - Done button

**Actions:**
- Toggle split payment on/off
- Adjust player count (if split enabled)
- Continue to next step

---

### **Step 2: Payment Method & Breakdown**

**Screen Elements:**
- Progress bar (Step 2 of ~4)
- Player indicators (if split payment):
  - Player 1 (active), Player 2, Player 3
  - Circles with numbers, active one highlighted

- Detail Breakdown:
  - Players Allowed to Play: 4
  - Booking Fee: ₱350.00

**Split Payment Activated:**
- **Highlighted box:**
  - Booking Fee: ₱350.00
  - Player(s) Fee: ₱175.00
  - Total Amount Due: ₱175.00
- Play Together info repeated (with number badge showing player count)

**Payment Method Selection:**
- ⭕ E-Wallet (radio button)
- ⭕ Cash (radio button)
- Selected method is filled circle

**Warning (if Cash selected):**
- ⚠️ Orange warning box
- "Lack of Cash payment will result into account restriction. See Policy."

**Actions:**
- Select payment method
- Continue to policy acceptance

---

### **Step 3: Cancellation Policy**

**Screen Elements:**
- Progress bar (Step 3 of ~4)
- Title: "Cancellation Policy"
- Subtitle: "Guidelines on booking cancellations, refunds, and applicable fees"

**Payment Method Tabs:**
- [E-Wallet] [Cash]
- Tabs to switch between policy types

**Policy Content (Bulleted):**
- You can cancel your booking anytime
- Refunds are only available within 7 days after full payment
- After 7 days, no refund will be issued
- For partial payments, only the amount paid will be refunded
- If the court manager cancels your booking, you'll receive a full refund regardless of the 7-day limit

**Confirmation Checkbox:**
- ☐ "I have read the Cancellation Policy for E-wallet Payment"
- Must be checked to proceed

**Info Box:**
- 💡 Blue info icon
- "This provides a clear refund flow and fairness for both sides while automating deductions via the e-wallet system"

**Actions:**
- Switch between payment method tabs
- Check policy confirmation
- Continue to payment

---

### **Step 4a: Payment Processing (E-Wallet - Single Payment)**

**Screen Elements:**
- Progress bar (Step 3-4 of ~4)
- Detail Breakdown (same as before)
- Play Together toggle info

**Payment Section:**
- Large QR Code displayed
- "paymongo.link" text
- "alternative link" (clickable)

**Actions:**
- Scan QR code with e-wallet app
- Wait for payment confirmation

---

### **Step 4b: Payment Processing (E-Wallet - Split Payment)**

**Multi-Player Flow:**

**Player Payment Tracking:**
- Top: Player circles showing status
  - Player 1: ✓ (checkmark - paid)
  - Player 2: Active number (current)
  - Player 3: Inactive number (pending)

**Current Player Payment:**
- Detail Breakdown showing:
  - Booking Fee: ₱350.00
  - Player(s) Fee: ₱175.00
  - Total Amount Due: ₱175.00
- QR Code for current player
- "paymongo.link"
- "alternative link"

**Payment Status Messages:**

**Before All Paid:**
- ⚠️ Red warning box
- "Warning! All players must pay to proceed"

**After Individual Payment:**
- ✓ Green success box
- "Payment Successful"
- Masked reference: "G**** M*E" or "J**A*** M**"

**Actions:**
- Each player scans their QR code
- System tracks payment per player
- Automatically advances to next player
- Shows warning until all complete

---

### **Step 4c: Payment Processing (Cash)**

**Screen Elements:**
- Progress bar (Step 3-4 of ~4)
- Detail Breakdown
- Payment method selector:
  - ⭕ E-Wallet
  - ⚫ Cash (selected)

**Cash Warning:**
- ⚠️ Orange warning box
- "Lack of Cash payment will result into account restriction. See Policy."

**Actions:**
- Select Cash payment
- Continue (presumably to in-person payment at venue)

---

### **Step 5: Booking Confirmation**

**Success Screen:**
- Progress bar (complete)
- Player status: All players marked ✓
- Large success icon/animation (implied)
- Title: "MOP Accepted"
  - MOP = Method of Payment
- Message: "Thank you for booking!"
- [Done] button

**Actions:**
- Done → Returns to booking details or home
- Presumably sends confirmation email/notification

---

## 💡 Additional Features Observed

### **Discount Support:**
One screen shows:
- **Discount scenario** (from court detail "Anniversary Discount" banner):
  - Booking Fee: ₱350.00
  - Discount: -₱50.00
  - Overall Total: ₱350.00 (after discount)

### **Date/Time Selection:**
Shown in separate booking screen:
- Date picker with calendar
- Time range: From [07:00] To [07:30]
- Shows "Tuesday, Apr 18, 2025"

---

## 🔍 Missing Elements & Inconsistencies

### **Critical Missing:**

1. **Court Availability Check**
   - No validation that court is available for selected time
   - No conflict checking with existing bookings

2. **Payment Timeout Handling**
   - What happens if players don't pay within reasonable time?
   - How long do QR codes remain valid?
   - Automatic cancellation mechanism?

3. **Booking Confirmation Details**
   - Booking ID/Reference number
   - Confirmation email address
   - Add to calendar option
   - Receipt/invoice download

4. **Entry Point**
   - How do users get from court detail page to checkout?
   - "Book Now" button → Where does it go?
   - Availability calendar integration

5. **Error Handling**
   - Payment failures
   - QR code expiration
   - Network errors
   - Duplicate payments

6. **Navigation**
   - Back button behavior (does it cancel booking?)
   - Cancel booking option
   - Edit booking before confirmation

### **Minor Inconsistencies:**

1. **Progress Bar Steps**
   - Number of steps varies (3-4 steps shown)
   - Step 3 seems to be both "Policy" and "Payment"
   - Should be clearer: Selection → Details → Payment → Confirmation

2. **Payment Method Selection**
   - Shows on Step 2 in some screens
   - Shows on Step 3 (Policy page) in others
   - Should be consistent placement

3. **Cancellation Policy Timing**
   - Policy shown AFTER payment method selection
   - Better UX: Show before any commitment

4. **Cash Payment Flow**
   - Unclear what happens after "Continue"
   - Does it create pending booking?
   - How is cash payment verified at venue?

5. **Split Payment Limitations**
   - Minimum 2 players shown
   - But text says "Maximum to only allowed players"
   - Should clarify both min and max

---

## 🗄️ Database Requirements

### **Tables Needed:**

1. **reservations**
   - ✅ Already exists in schema
   - Fields needed:
     - `id`, `court_id`, `user_id` (booking creator)
     - `reservation_date`, `start_time`, `end_time`
     - `total_amount`, `amount_paid`, `status`
     - `payment_method`, `is_split_payment`
     - `players_count`
     - `cancellation_deadline`

2. **payment_splits** (NEW - needs verification)
   - `id`, `reservation_id`
   - `player_email` or `player_id`
   - `amount_due`, `amount_paid`
   - `payment_status` (pending, paid, failed)
   - `qr_code_url`, `payment_reference`
   - `paid_at`

3. **payments**
   - ✅ Already exists
   - Fields: `id`, `reservation_id`, `user_id`
   - `amount`, `payment_method`, `status`
   - `external_id` (PayMongo transaction ID)
   - `qr_code_url`

### **Missing Fields to Add:**

1. **reservations table:**
   - `cancellation_policy_accepted` BOOLEAN
   - `booking_reference` VARCHAR (unique booking ID for customers)
   - `cancellation_requested_at` TIMESTAMPTZ
   - `cancelled_by` UUID

2. **discount_rules application:**
   - `discount_applied` JSONB (store which discount was used)
   - `original_amount` NUMERIC
   - `discount_amount` NUMERIC

---

## 🎨 Desktop Implementation Recommendations

### **Layout Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│  Checkout                                      [Cancel] [X]  │
├─────────────────────────────────────────────────────────────┤
│  [●─────○─────○─────○]  Progress Stepper                   │
│   Details Payment Policy Confirm                             │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│  Left Column (60%)       │  Right Column (40%)             │
│  ----------------------  │  --------------------------      │
│                          │                                  │
│  • Court Details Card    │  • Summary Card                 │
│  • Date/Time Display     │    - Court name                 │
│  • Player Count          │    - Date & Time                │
│  • Payment Options       │    - Players: X                 │
│  • Policy Acceptance     │    - Booking Fee: ₱XXX         │
│                          │    - Discount: -₱XX             │
│                          │    - Total: ₱XXX                │
│                          │                                  │
│                          │  [Continue Button]              │
│                          │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

### **Step-by-Step Desktop Design:**

#### **Step 1: Booking Details**
- Two-column layout
- Left: Court card with image, details, amenities
- Right: Sticky summary card
- Date/time selector (if not already selected)
- Player count with toggle:
  - Switch: "Split payment among players"
  - Counter: [−] 2 [+] (when enabled)
- Continue button in summary card

#### **Step 2: Payment Method**
- Left: Payment options as large cards
  - [E-Wallet] card with icon, description, benefits
  - [Cash] card with icon, warning message
- Right: Updated summary with split amounts (if applicable)
- Player indicators if split payment (horizontal row of circles)

#### **Step 3: Cancellation Policy**
- Left: Tabbed policy content (E-Wallet / Cash tabs)
  - Formatted with proper spacing
  - Checkbox at bottom
- Right: Summary remains
- Info callout about fairness

#### **Step 4: Payment Processing**

**Single Payment:**
- Center modal/overlay with QR code
- Payment instructions
- Loading state while waiting
- Success animation

**Split Payment:**
- Modal showing current player
- Progress: "Player 2 of 3"
- QR code for current player
- List showing: ✓ Paid | ⏳ Pending | ○ Waiting
- Auto-advance to next player on payment

#### **Step 5: Confirmation**
- Full-width success screen
- Booking details card
- Booking reference number
- Actions:
  - [Download Receipt]
  - [Add to Calendar]
  - [View Booking]
  - [Done]

---

## 🔧 Technical Implementation Plan

### **Phase 1: Frontend Components (Week 1)**

1. **Create Checkout Page Structure**
   - `/app/(main)/checkout/page.tsx`
   - Server component for initial data
   - Client components for interactive parts

2. **Build Reusable Components:**
   - `<CheckoutProgress />` - Stepper
   - `<CourtSummary />` - Right sidebar
   - `<PlayerCounter />` - Split payment controls
   - `<PaymentMethodSelector />` - E-Wallet/Cash cards
   - `<CancellationPolicy />` - Tabbed policy view
   - `<PaymentQRCode />` - QR display and tracking
   - `<BookingSuccess />` - Confirmation screen

3. **State Management:**
   - Use Zustand store for checkout state
   - Track: step, players, method, policy acceptance
   - Persist state during flow

### **Phase 2: Backend API (Week 1-2)**

1. **Create Booking API Endpoints:**
   ```
   POST /api/reservations/create
   POST /api/reservations/[id]/add-player
   GET  /api/reservations/[id]/payment-status
   POST /api/reservations/[id]/confirm-cash
   POST /api/reservations/[id]/cancel
   ```

2. **PayMongo Integration:**
   - Create QR code generation function
   - Webhook handler for payment status
   - Split payment handling

3. **Availability Checking:**
   - Implement conflict detection
   - Hold time slot during checkout (15-30 min)
   - Auto-release on abandon

### **Phase 3: Database Updates (Week 2)**

1. **Add Missing Fields:**
   - Update reservations table
   - Create payment_splits table (if needed)
   - Add indexes for performance

2. **Create Stored Procedures:**
   - `check_availability()`
   - `create_split_payment_reservation()`
   - `process_player_payment()`

### **Phase 4: Testing & Polish (Week 2)**

1. **Integration Testing:**
   - Complete booking flows
   - Split payment scenarios
   - Error handling

2. **UX Enhancements:**
   - Loading states
   - Error messages
   - Success animations
   - Email confirmations

---

## 📋 Implementation Checklist

### **Must-Have (MVP):**
- [ ] Checkout page layout (desktop-optimized)
- [ ] Progress stepper component
- [ ] Court summary sidebar
- [ ] Split payment toggle and counter
- [ ] Payment method selection
- [ ] Cancellation policy display and acceptance
- [ ] QR code generation (e-wallet)
- [ ] Payment status tracking
- [ ] Booking confirmation screen
- [ ] Availability checking before checkout
- [ ] Reservation creation in database
- [ ] Email confirmation

### **Should-Have (V2):**
- [ ] Cash payment verification flow
- [ ] Multi-player payment tracking UI
- [ ] Payment timeout handling
- [ ] Automatic cancellation on abandon
- [ ] Booking reference generation
- [ ] Receipt PDF generation
- [ ] Add to calendar functionality
- [ ] Discount code application
- [ ] Partial refund handling

### **Nice-to-Have (Future):**
- [ ] Real-time payment notifications (WebSockets)
- [ ] SMS notifications for split payment
- [ ] Reminder emails before booking time
- [ ] Booking modification (reschedule)
- [ ] Wait list for fully booked slots
- [ ] Booking history and receipts page

---

## 🎯 Next Steps

1. **Review this analysis** with the team
2. **Confirm database schema** matches requirements
3. **Design desktop mockups** based on recommendations
4. **Break down into user stories** for sprint planning
5. **Start with Phase 1** (Frontend Components)

---

## 📝 Notes & Questions

**Questions to Address:**
1. Should we allow partial bookings (some players paid, others pending)?
2. What's the timeout for split payment completion? 30 min? 1 hour?
3. How do we handle no-shows for cash payments?
4. Should users get calendar invites automatically?
5. Do we need booking modification/cancellation in MVP?

**Design Decisions Needed:**
1. Modal vs full-page for payment flow?
2. Payment method selection timing (before or after policy)?
3. Progress bar: 4 steps or 5?
4. Split payment: Show all QR codes or one at a time?

---

**End of Analysis**
