# Rallio Documentation

This folder contains all technical documentation, design specs, and planning materials for the Rallio platform.

---

## 📁 Documentation Structure

### Planning & Progress
- **`planning.md`** - Development phases, roadmap, and phase completion status
- **`tasks.md`** - Detailed task checklist organized by phase and category

### Database & Schema
- **`CURRENT_DATABASE_FEATURES.md`** - Feature catalog for V2 database schema (26 tables)
- **`V1_VS_V2_SCHEMA_CHANGES.md`** - Migration comparison between V1 and V2 schemas
- **`QUEUE_SYSTEM_GUIDE.md`** - Complete queue management system documentation

### System Analysis
Located in `/docs/system-analysis/`:
- **`rallio-system-analysis.md`** - Complete system overview and feature specifications
- **`prototype-analysis.md`** - Mobile UI/UX prototype analysis
- **`rallio-database-schema.sql`** - V1 schema reference (archived)

### Design Assets
Located in `/docs/design/`:
- 26 mobile prototype UI screenshots (PNG files)
- Design mockups for onboarding, home, courts, queues, profile, etc.

### Placeholder Folders (Future Content)
- `/docs/api/` - API endpoint documentation (Phase 2+)
- `/docs/development/` - Setup guides and coding standards (WIP)
- `/docs/progress/` - Progress tracking logs (WIP)

---

## 🚀 Quick Links

### For Developers
1. Start with **`planning.md`** to understand current phase
2. Check **`tasks.md`** for specific implementation tasks
3. Review **`QUEUE_SYSTEM_GUIDE.md`** for queue feature details
4. Reference **`CURRENT_DATABASE_FEATURES.md`** for what's built

### For Designers
1. Check **`/design/`** folder for UI mockups
2. Review **`prototype-analysis.md`** for mobile UX analysis
3. See **`rallio-system-analysis.md`** for feature requirements

### For Database/Backend
1. See **`/backend/supabase/migrations/001_initial_schema_v2.sql`** (source of truth)
2. Review **`CURRENT_DATABASE_FEATURES.md`** for implemented features
3. Check **`V1_VS_V2_SCHEMA_CHANGES.md`** for migration context

---

## 📊 Current Status

**Phase 1: Foundation & Core Auth** ✅ **COMPLETE**
- Database V2 schema deployed (26 tables)
- Authentication working (Supabase Auth)
- User profiles and player onboarding functional

**Phase 2: Court Discovery & Display** 🔄 **IN PROGRESS**
- Venue and court listing
- Map integration (Leaflet)
- Court detail pages

---

## 🔗 Related Files

- `/CLAUDE.md` - AI assistant context and project guidelines (root level)
- `/README.md` - Project overview and quick start (root level)
- `/backend/README.md` - Backend setup instructions
- `/web/README.md` - Web app setup instructions (to be updated)

---

**Last Updated:** November 19, 2025  
**Documentation Version:** 2.0
