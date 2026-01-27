# Rallio Mobile App - Planning Summary

**Last Updated:** January 27, 2026  
**Status:** Planning Phase - Awaiting Approval  
**Scope:** Player Role Mobile App (React Native + Expo 54)

---

## Quick Summary

> This document summarizes the mobile app conversion analysis. See [implementation_plan.md](../../../.gemini/antigravity/brain/e94ce7c8-904b-4bbf-815d-fb60d572df73/implementation_plan.md) for full details.

### Web App Analysis (Step 1)

| Area | Status | Notes |
|------|--------|-------|
| Auth | ✅ 100% | Email/password + Google OAuth |
| Court Discovery | ✅ 90% | Leaflet maps, PostGIS search |
| Booking & Payments | ✅ 90% | PayMongo GCash/Maya working |
| Queue System | ✅ 90% | Real-time position tracking |
| Admin Dashboards | ✅ 85% | Court, Queue Master, Global |
| Ratings | 🟡 30% | Backend done, UI needs testing |
| Notifications | 🟡 50% | In-app done, push pending |
| Testing | ❌ 0% | Critical gap |

### Core Features (Step 2)

**Essential (MVP)**
1. Authentication (email/password, Google)
2. Court discovery (list + map)
3. Booking flow with PayMongo
4. Queue participation
5. My Bookings management

**Secondary**
- Match history
- Ratings/reviews
- Push notifications

**Admin-only** (web remains)
- Court/Queue Master/Global Admin dashboards

### Mobile UX Improvements (Step 3)

| Web Feature | Mobile Enhancement |
|-------------|-------------------|
| Login | + Biometric (Face ID/Touch ID) |
| Map | + Native performance, clusters |
| Calendar | + Today/Tomorrow quick buttons |
| Payments | + Deep link to GCash/Maya app |
| Queue | + Push notification on turn |

### UI Direction (Step 4)

- **Theme:** Dark-centered (#0A0A0F base)
- **Accent:** Rallio Orange (#FF6B35)
- **Glassmorphism:** Subtle - 5% white bg, 8px blur
- **Accessibility:** 44pt touch, 4.5:1 contrast

### Tech Stack (Step 5)

- **Framework:** React Native + Expo 54 ✅ (already initialized)
- **Navigation:** Expo Router
- **State:** Zustand + AsyncStorage
- **Backend:** Same Supabase (no changes)

### Timeline (Step 6)

| Week | Focus |
|------|-------|
| 1 | Theme, components, auth screens |
| 2 | Court discovery, map view |
| 3 | Booking flow, payments |
| 4 | Queue system |
| 5 | Notifications |
| 6 | Profile, polish |
| 7 | Launch prep |

---

## Files Created

| File | Purpose |
|------|---------|
| [MOBILE_APP_TASKS.md](./MOBILE_APP_TASKS.md) | Detailed task checklist |
| [implementation_plan.md](../../../.gemini/antigravity/brain/e94ce7c8-904b-4bbf-815d-fb60d572df73/implementation_plan.md) | Full analysis document |

---

## Next Steps

Review the implementation plan and provide feedback on:

1. **Scope:** Player-only mobile app correct?
2. **Timeline:** 7 weeks acceptable?
3. **Features:** Add/remove anything?
4. **Stack:** React Native or Flutter?
5. **Testing:** Manual vs automated?
