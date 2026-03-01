    # Rallio – Comprehensive Testing Plan

    > **Badminton Court Finder & Queue Management System**  
    > Monorepo: `web` (Next.js 16) · `mobile` (Expo 54 / RN 0.81) · `backend` (Supabase) · `shared` (Zod validations, types, utils)

    ---

    ## 7.1. Testing Plan

    ### 7.1.1. Test Strategy and Approach

    #### 7.1.1.1. Test Type

    The testing strategy employs a multi-layered approach following the testing pyramid principle:

    | Test Type | Tool | Scope | Priority |
    |---|---|---|---|
    | **Unit Tests** | Vitest (web/shared), Jest (mobile) | Pure functions, validations, utilities, stores | High |
    | **Integration Tests** | Vitest + Mock Supabase Client | Server actions, API routes, hooks | High |
    | **Component Tests** | React Testing Library (web), RN Testing Library (mobile) | Interactive UI components, forms | Medium |
    | **E2E Tests** | Playwright (web), Maestro/Detox (mobile) | Critical user journeys | Medium |
    | **Database Tests** | Supabase CLI + SQL assertions | Migrations, seed data, RLS policies | Medium |
    | **Performance Tests** | Load testing tools, manual stress tests | System behavior under load | Low |

    **Rationale:**
    - **Unit tests** provide the highest ROI with fast execution and zero external dependencies
    - **Integration tests** validate business logic flows without full E2E overhead
    - **Component tests** ensure UI interactions work correctly
    - **E2E tests** verify end-to-end user journeys but are expensive to maintain
    - **Database tests** ensure data integrity and security policies

    ---

    #### 7.1.1.2. Scope

    **In Scope:**

    1. **Shared Package (`shared/`)**
    - All Zod validation schemas (10 schemas)
    - All utility functions (15+ functions)
    - Type definitions and interfaces

    2. **Web Application (`web/`)**
    - 25 server actions (queue, payments, reservations, matches, admin)
    - 8 custom hooks (use-queue, use-auth, use-queue-notifications, etc.)
    - 10 Zustand stores (auth, checkout, ui, etc.)
    - Critical components (auth forms, booking flow, queue dashboard, admin panels)
    - 7 API routes (mobile endpoints, webhooks, cron)
    - Queue status machine logic
    - Rate limiting logic

    3. **Mobile Application (`mobile/`)**
    - 5 Zustand stores (auth, booking, queue, court, location)
    - Critical screens (login, booking, queue participation)
    - API integration points

    4. **Backend (`backend/`)**
    - Database migrations (42 migration files)
    - Seed data integrity
    - Edge functions (auto-close-sessions)
    - RLS (Row Level Security) policies
    - Database functions (auto-close logic)

    5. **Critical User Flows (E2E)**
    - User registration and authentication
    - Court browsing and booking
    - Queue session lifecycle (create → join → play → pay → complete)
    - Payment processing and refunds
    - Court admin venue management

    **Out of Scope (Initial Phase):**

    - Visual regression testing
    - Accessibility (a11y) automated testing (manual review recommended)
    - Cross-browser compatibility (Chrome/Firefox/Safari manual testing)
    - Mobile device-specific E2E (focus on web first)
    - Third-party service integration testing (PayMongo, external APIs)
    - Load testing beyond basic stress tests
    - Security penetration testing (separate security audit recommended)

    ---

    #### 7.1.1.3. Risk and Issues

    | Risk | Impact | Probability | Mitigation |
    |---|---|---|---|
    | **No existing test infrastructure** | High | Certain | Start with unit tests (fastest to set up), use Vitest for quick adoption |
    | **Complex queue logic (84KB file)** | High | High | Break down into smaller testable units, mock Supabase client thoroughly |
    | **Real-time features (Supabase subscriptions)** | Medium | Medium | Mock real-time channels in tests, use integration tests for actual behavior |
    | **Payment webhook testing** | High | Medium | Use PayMongo test mode, mock webhook payloads, test idempotency |
    | **Database state management** | Medium | Medium | Use Supabase local instance for E2E, reset database between test runs |
    | **Mobile E2E complexity** | Medium | Low | Defer mobile E2E to Phase 2, focus on web first |
    | **Time-dependent logic (auto-close sessions)** | Medium | Medium | Mock time in unit tests, use real time in integration tests |
    | **Rate limiting edge cases** | Low | Low | Test boundary conditions, expired windows, cleanup logic |
    | **Test maintenance overhead** | Medium | Medium | Focus on high-value tests, avoid over-testing UI components |
    | **CI/CD pipeline complexity** | Low | Low | Use GitHub Actions templates, start simple and iterate |

    **Known Issues:**

    1. **Zero test coverage currently** - All tests must be written from scratch
    2. **Monorepo workspace configuration** - Need to configure test runners per package
    3. **Supabase client mocking** - Requires custom mock factory for server actions
    4. **Next.js 16 server actions** - Testing patterns still evolving, may need adaptation
    5. **Expo 54 / React Native 0.81** - Mobile testing setup may require additional configuration

    ---

    #### 7.1.1.4. Test Logistics

    **Test Environment Setup:**

    1. **Local Development**
    - Node.js 18+ installed
    - Supabase CLI installed (`supabase start` for local instance)
    - PostgreSQL 15+ (via Supabase local)
    - Test database seeded with minimal data

    2. **CI/CD Environment**
    - GitHub Actions runners (Ubuntu latest)
    - Supabase CLI available
    - Node.js 18+ installed
    - Playwright browsers installed (`npx playwright install --with-deps`)

    3. **Test Data Management**
    - Seed scripts for consistent test data
    - Database reset between E2E test runs
    - Mock data factories for unit/integration tests
    - Test user accounts (player, queue_master, court_admin, global_admin)

    **Test Execution Strategy:**

    - **Unit tests**: Run on every commit (fast feedback, < 30 seconds)
    - **Integration tests**: Run on every commit (medium feedback, < 2 minutes)
    - **Component tests**: Run on every commit (medium feedback, < 3 minutes)
    - **E2E tests**: Run on pull requests and main branch (slower, < 10 minutes)
    - **Database tests**: Run on pull requests (migration validation)

    **Test Reporting:**

    - Coverage reports generated via Vitest/Jest
    - Coverage thresholds enforced (70% overall, 100% for shared utilities)
    - Test results published to GitHub Actions
    - Coverage reports uploaded as artifacts

    **Test Maintenance:**

    - Tests reviewed during code review process
    - Failing tests block merges (enforced via branch protection)
    - Test documentation updated when test strategy changes
    - Regular test suite health checks (monthly review)

    ---

    ### 7.1.2. Test Objective

    The primary objective of this comprehensive testing plan is to establish a robust, maintainable test suite that ensures the reliability, correctness, and quality of the Rallio badminton court finder and queue management system across all layers of the application.

    **Specific Objectives:**

    1. **Quality Assurance**
    - Verify that all business logic functions correctly under normal and edge conditions
    - Ensure data integrity across all database operations
    - Validate that user-facing features work as expected
    - Confirm that security policies (RLS) are properly enforced

    2. **Regression Prevention**
    - Detect breaking changes early in the development cycle
    - Prevent introduction of bugs when adding new features
    - Maintain backward compatibility for API contracts
    - Ensure existing functionality remains intact after refactoring

    3. **Documentation Through Tests**
    - Tests serve as executable documentation of system behavior
    - Clarify expected behavior for complex business logic (queue management, payment flows)
    - Provide examples of correct usage patterns
    - Document edge cases and error handling

    4. **Confidence in Deployment**
    - Enable safe, frequent deployments to production
    - Reduce manual testing overhead
    - Provide fast feedback to developers
    - Support continuous integration and delivery practices

    5. **Risk Mitigation**
    - Identify critical bugs before production release
    - Validate payment processing logic (high financial risk)
    - Ensure queue management fairness and correctness
    - Verify data security and access controls

    6. **Performance Validation**
    - Identify performance bottlenecks early
    - Ensure system handles expected load (20+ concurrent users per queue)
    - Validate real-time update latency (< 1 second)
    - Test auto-close function with large datasets (100+ sessions)

    7. **User Experience Verification**
    - Ensure critical user journeys work end-to-end
    - Validate form validation and error messages
    - Confirm notification system functions correctly
    - Verify responsive design on key screens

    **Success Criteria:**

    - **Phase 1**: 100% coverage of shared utilities and validations, all tests passing
    - **Phase 2**: 80%+ coverage of server action business logic, critical flows tested
    - **Phase 3**: Key interactive components tested, hooks validated
    - **Phase 4**: 5 critical E2E flows passing, CI/CD pipeline operational
    - **Long-term**: 70% overall code coverage, < 5% test flakiness rate, < 10 minute CI execution time

    ---

    ### 7.1.3. Test Criteria

    #### 7.1.3.1. Entry Criteria

    Entry criteria define the conditions that must be met before testing activities can begin. These ensure that the system is in a testable state and that all prerequisites are satisfied.

    **General Entry Criteria:**

    1. **Code Readiness**
    - [ ] Feature code is complete and merged to the target branch
    - [ ] Code has passed initial code review
    - [ ] No known blocking bugs exist in the feature area
    - [ ] Code follows project coding standards and conventions

    2. **Test Environment**
    - [ ] Test environment is available and accessible
    - [ ] Local Supabase instance can be started (`supabase start` succeeds)
    - [ ] Test database is seeded with required test data
    - [ ] All required environment variables are configured
    - [ ] Test user accounts are created (player, queue_master, court_admin, global_admin)

    3. **Test Infrastructure**
    - [ ] Test runners are installed and configured (Vitest, Jest, Playwright)
    - [ ] Test dependencies are installed (`npm install` completed)
    - [ ] Mock factories are available (Supabase client mocks)
    - [ ] Test utilities and helpers are in place
    - [ ] CI/CD pipeline is configured (for automated testing)

    4. **Documentation**
    - [ ] Feature requirements are documented
    - [ ] API contracts are defined (for server actions and API routes)
    - [ ] Database schema changes are documented (for migration tests)
    - [ ] Test data requirements are specified

    5. **Access and Permissions**
    - [ ] Testers have access to test environment
    - [ ] Testers have necessary database permissions (for E2E tests)
    - [ ] Testers have access to required external services (PayMongo test mode)
    - [ ] GitHub Actions secrets are configured (for CI/CD)

    **Phase-Specific Entry Criteria:**

    **Phase 1 (Unit Tests):**
    - [ ] Vitest installed in `shared/` and `web/` packages
    - [ ] Jest installed in `mobile/` package
    - [ ] Test scripts configured in `package.json` files
    - [ ] No external dependencies required (pure functions only)

    **Phase 2 (Integration Tests):**
    - [ ] Supabase client mock factory implemented
    - [ ] Unit tests passing (Phase 1 complete)
    - [ ] Server action interfaces documented
    - [ ] Test data factories created

    **Phase 3 (Component Tests):**
    - [ ] React Testing Library installed
    - [ ] React Native Testing Library installed (for mobile)
    - [ ] Integration tests passing (Phase 2 complete)
    - [ ] Component test utilities and render helpers available

    **Phase 4 (E2E Tests):**
    - [ ] Playwright installed and configured
    - [ ] Local Supabase instance running
    - [ ] Component tests passing (Phase 3 complete)
    - [ ] E2E test data seeded
    - [ ] Test user accounts created with appropriate roles

    **Database Tests:**
    - [ ] Supabase CLI installed
    - [ ] Local Supabase instance can be started
    - [ ] Migration files are available
    - [ ] Seed data scripts are available

    ---

    #### 7.1.3.2. Suspension Criteria

    Suspension criteria define conditions under which testing activities should be temporarily halted. Testing should be suspended when these conditions are met to prevent wasted effort and ensure accurate results.

    **Test Execution Suspension:**

    1. **Environment Issues**
    - [ ] Test environment is unavailable or unstable
    - [ ] Database connection failures persist (> 3 consecutive failures)
    - [ ] Supabase local instance crashes or becomes unresponsive
    - [ ] External service dependencies are down (PayMongo API, etc.)
    - [ ] Network connectivity issues prevent test execution

    2. **Infrastructure Problems**
    - [ ] Test runners fail to start or crash repeatedly
    - [ ] CI/CD pipeline is broken and cannot execute tests
    - [ ] Test data corruption detected
    - [ ] Disk space or memory issues prevent test execution
    - [ ] Test environment configuration is incorrect or missing

    3. **Code Issues**
    - [ ] Critical bugs discovered that prevent meaningful testing
    - [ ] Code changes are in progress that affect test scope
    - [ ] Merge conflicts or integration issues block test execution
    - [ ] Test code itself has bugs that produce false results
    - [ ] Dependencies are missing or incompatible

    4. **Data Issues**
    - [ ] Test data is corrupted or inconsistent
    - [ ] Seed data scripts fail to execute
    - [ ] Database migrations fail or produce errors
    - [ ] Test user accounts are missing or have incorrect permissions
    - [ ] Test data conflicts with existing data

    5. **External Dependencies**
    - [ ] Third-party services (PayMongo, etc.) are unavailable
    - [ ] API rate limits are exceeded
    - [ ] Authentication services are down
    - [ ] Required external resources cannot be accessed

    **When to Suspend:**

    - **Immediate suspension**: Environment crashes, critical security issues, data corruption
    - **Temporary suspension**: Minor infrastructure issues, code changes in progress
    - **Partial suspension**: Only affected test suites are suspended, others continue

    **Suspension Process:**

    1. Document the reason for suspension
    2. Notify relevant team members
    3. Create an issue/ticket to track resolution
    4. Resume testing once criteria are met (see Resumption Criteria)

    ---

    #### 7.1.3.3. Resumption Criteria

    Resumption criteria define the conditions that must be met before suspended testing activities can resume. These ensure that the issues that caused suspension have been resolved.

    **General Resumption Criteria:**

    1. **Environment Stability**
    - [ ] Test environment is available and stable
    - [ ] Database connections are working reliably
    - [ ] Supabase local instance is running without errors
    - [ ] Network connectivity is restored
    - [ ] External service dependencies are operational

    2. **Infrastructure Readiness**
    - [ ] Test runners start successfully
    - [ ] CI/CD pipeline is operational
    - [ ] Test data is valid and consistent
    - [ ] Disk space and memory are sufficient
    - [ ] Test environment configuration is correct

    3. **Code Readiness**
    - [ ] Critical bugs have been fixed
    - [ ] Code changes are complete and stable
    - [ ] Merge conflicts are resolved
    - [ ] Test code bugs are fixed
    - [ ] Dependencies are installed and compatible

    4. **Data Integrity**
    - [ ] Test data is restored and validated
    - [ ] Seed data scripts execute successfully
    - [ ] Database migrations are applied correctly
    - [ ] Test user accounts exist with correct permissions
    - [ ] No data conflicts exist

    5. **Verification**
    - [ ] A smoke test suite passes (basic functionality verified)
    - [ ] At least one test from each category (unit, integration, component) passes
    - [ ] No blocking errors in test execution logs
    - [ ] Test environment health checks pass

    **Resumption Process:**

    1. Verify all resumption criteria are met
    2. Run smoke tests to confirm basic functionality
    3. Document resumption in test logs
    4. Notify team members that testing has resumed
    5. Begin with previously suspended test suites
    6. Monitor for recurring issues

    **Partial Resumption:**

    - If only specific test suites were suspended, resume only those suites
    - Other test suites can continue running if unaffected
    - Document which suites are resumed and which remain suspended

    ---

    #### 7.1.3.4. Exit Criteria

    Exit criteria define the conditions that must be met before testing activities for a given phase, feature, or release can be considered complete. These ensure that quality standards are met before moving to the next phase or releasing to production.

    **General Exit Criteria:**

    1. **Test Coverage**
    - [ ] **Phase 1**: 100% coverage of `shared/` utilities and validations
    - [ ] **Phase 2**: 80%+ coverage of server action business logic branches
    - [ ] **Phase 3**: Key interactive components covered (auth forms, booking flow, queue dashboard)
    - [ ] **Phase 4**: 5 critical E2E user journeys covered
    - [ ] **Overall**: 70% line coverage across the codebase

    2. **Test Execution**
    - [ ] All unit tests pass (100% pass rate)
    - [ ] All integration tests pass (100% pass rate)
    - [ ] All component tests pass (100% pass rate)
    - [ ] All E2E tests pass (100% pass rate, allowing for < 5% flakiness)
    - [ ] All database migration tests pass
    - [ ] Test execution time is within acceptable limits (< 10 minutes for full suite)

    3. **Defect Management**
    - [ ] All critical and high-priority bugs are fixed and verified
    - [ ] All medium-priority bugs are fixed or documented with acceptable workarounds
    - [ ] Low-priority bugs are documented and prioritized for future releases
    - [ ] No blocking issues remain open
    - [ ] Bug fix verification tests are added to prevent regression

    4. **Code Quality**
    - [ ] Code review is completed and approved
    - [ ] Linter errors are resolved
    - [ ] TypeScript compilation succeeds without errors
    - [ ] No security vulnerabilities detected (or documented and accepted)
    - [ ] Performance benchmarks are met (page load < 2s, real-time updates < 1s)

    5. **Documentation**
    - [ ] Test documentation is updated
    - [ ] Test cases are documented for critical flows
    - [ ] Known limitations and edge cases are documented
    - [ ] Test data requirements are documented
    - [ ] Test environment setup instructions are current

    6. **CI/CD Integration**
    - [ ] Tests run automatically on every commit
    - [ ] Tests run automatically on pull requests
    - [ ] Test failures block merges (enforced via branch protection)
    - [ ] Coverage reports are generated and published
    - [ ] Test results are visible in GitHub Actions

    **Phase-Specific Exit Criteria:**

    **Phase 1 (Unit Tests) - Exit Criteria:**
    - [ ] All validation schema tests pass (50+ test cases)
    - [ ] All utility function tests pass (40+ test cases)
    - [ ] Queue status machine tests pass (25+ test cases)
    - [ ] Rate limiter tests pass (15+ test cases)
    - [ ] Zustand store tests pass (web + mobile)
    - [ ] 100% coverage of `shared/` package
    - [ ] Test execution time < 30 seconds

    **Phase 2 (Integration Tests) - Exit Criteria:**
    - [ ] All server action tests pass (queue, payments, reservations, matches, admin)
    - [ ] All API route tests pass
    - [ ] All custom hook tests pass
    - [ ] 80%+ coverage of server action business logic
    - [ ] Mock Supabase client factory is working correctly
    - [ ] Test execution time < 2 minutes

    **Phase 3 (Component Tests) - Exit Criteria:**
    - [ ] Auth form component tests pass
    - [ ] Booking flow component tests pass
    - [ ] Queue dashboard component tests pass
    - [ ] Admin panel component tests pass
    - [ ] Key interactive components covered
    - [ ] Test execution time < 3 minutes

    **Phase 4 (E2E Tests) - Exit Criteria:**
    - [ ] Signup → Login flow passes
    - [ ] Browse Courts → Book flow passes
    - [ ] Queue Session Lifecycle flow passes
    - [ ] Court Admin: Manage Venue flow passes
    - [ ] Payment → Refund flow passes
    - [ ] All E2E tests pass with < 5% flakiness
    - [ ] Test execution time < 10 minutes
    - [ ] CI/CD pipeline is operational

    **Database Tests - Exit Criteria:**
    - [ ] All migrations apply successfully
    - [ ] Seed data loads correctly
    - [ ] RLS policies are tested and working
    - [ ] Database functions (auto-close) work correctly
    - [ ] No migration rollback issues

    **Release Exit Criteria (Production Readiness):**

    - [ ] All phase exit criteria are met
    - [ ] Performance tests pass (load, stress, latency)
    - [ ] Security review completed (or scheduled)
    - [ ] User acceptance testing (UAT) completed (if applicable)
    - [ ] Deployment plan is documented
    - [ ] Rollback plan is documented
    - [ ] Monitoring and alerting are configured
    - [ ] Production environment is ready
    - [ ] Stakeholder approval obtained

    **Sign-Off Process:**

    1. Test lead reviews all exit criteria
    2. Development team confirms all criteria are met
    3. Product owner/stakeholder approval (for release)
    4. Documentation updated with test results
    5. Test summary report generated
    6. Proceed to next phase or production deployment

    ---

    ## 4. Layer-by-Layer Plan

    ### 4.1 Unit Tests (Start Here) 🟢

    These are pure-function tests with **zero external dependencies** — the highest ROI starting point.

    #### 4.1.1 `shared/src/validations/` – Zod Schemas

    | Schema | Test Cases |
    |---|---|
    | `loginSchema` | valid email+password; invalid email; password < 8 chars |
    | `signupSchema` | valid full input; missing firstName; password mismatch; no uppercase; no number |
    | `resetPasswordSchema` | valid; mismatch passwords |
    | `createVenueSchema` | valid; missing name; latitude out-of-range (-91, 91) |
    | `createCourtSchema` | valid; invalid `courtType` enum; capacity boundary (1, 2, 20, 21) |
    | `createReservationSchema` | valid; bad date format; bad time format |
    | `createQueueSessionSchema` | valid; `maxParticipants` boundary (3, 4, 50, 51) |
    | `createCourtRatingSchema` | valid; overallRating boundary (0, 1, 5, 6) |
    | `createPlayerRatingSchema` | valid; missing required fields |
    | `courtSearchSchema` | valid; partial fields; radius boundary |

    **File:** `shared/src/validations/__tests__/validations.test.ts`

    ---

    #### 4.1.2 `shared/src/utils/` – Utility Functions

    | Function | Test Cases |
    |---|---|
    | `formatDate` | valid Date, ISO string, invalid input → "Invalid date" |
    | `formatTime` | "14:30" → "2:30 PM", "00:00" → "12:00 AM" |
    | `formatCurrency` | 100 → "₱100.00" (PHP default) |
    | `calculateDistance` | Known coordinates → expected km (Haversine) |
    | `calculateAverageRating` | normal array; empty array → 0; single value |
    | `calculateNewEloRating` | win scenario; loss scenario; equal ratings |
    | `balanceTeams` | even players; odd players; skill ordering |
    | `slugify` | spaces, special chars, trim |
    | `isValidEmail` | valid; invalid patterns |
    | `isValidPhone` | PH formats: +639..., 09..., invalid |
    | `groupBy` / `sortBy` | normal use, empty arrays |

    **File:** `shared/src/utils/__tests__/utils.test.ts`

    ---

    #### 4.1.3 `web/src/lib/queue-status.ts` – Status Machine

    | Function | Test Cases |
    |---|---|
    | `getStatusConfig` | all known statuses return correct config; unknown status → fallback |
    | `canPlayersJoin` | `open` & `active` → true; all others → false |
    | `calculateExpectedStatus` | terminal states don't change; pending_payment doesn't change; time-based transitions (upcoming→open→active→completed); paused past end_time → completed |
    | `getTimeUntilOpen` | 3h before → "1h 0m"; exactly 2h → "Now"; 30min → "Now" |
    | `isSessionFinished` / `isSessionActive` / `isAwaitingPayment` | all variants |

    **File:** `web/src/lib/__tests__/queue-status.test.ts`

    ---

    #### 4.1.4 `web/src/lib/rate-limiter.ts` – Rate Limiting

    | Function | Test Cases |
    |---|---|
    | `checkRateLimit` | first request → allowed; max attempts → blocked; expired window → reset; `retryAfter` accuracy |
    | `getRateLimitStatus` | exists; expired → null; nonexistent → null |
    | `resetRateLimit` | resets entry; subsequent call → allowed |
    | `cleanupExpiredEntries` | removes expired; keeps valid |
    | `createRateLimitConfig` | maps RATE_LIMITS keys correctly |

    **File:** `web/src/lib/__tests__/rate-limiter.test.ts`

    ---

    #### 4.1.5 Zustand Stores (Web)

    | Store | Test Cases |
    |---|---|
    | `auth-store` | initial state; set/clear user |
    | `checkout-store` | add/remove items; total calculation; reset |
    | `ui-store` | toggle states |

    **File:** `web/src/stores/__tests__/stores.test.ts`

    ---

    #### 4.1.6 Zustand Stores (Mobile)

    | Store | Test Cases |
    |---|---|
    | `auth-store` | login/logout state; token persistence |
    | `booking-store` | select court/date/time; validation |
    | `queue-store` | join/leave queue state; participant tracking |
    | `court-store` | filter/sort courts |
    | `location-store` | set/clear location; permission states |

    **File:** `mobile/store/__tests__/stores.test.ts`

    ---

    ### 4.2 Integration Tests 🟡

    These require mocking Supabase but test real business logic flows.

    #### 4.2.1 Server Actions (Web) – High Priority

    The 25 server actions in `web/src/app/actions/` are the **business logic core**. Test with Supabase client mocked.

    | Action File | Key Scenarios |
    |---|---|
    | `queue-actions.ts` (84KB!) | Create session; join queue; leave queue; auto-rotate; skill balancing; max participants guard; rate-limit integration |
    | `payments.ts` (36KB) | Create checkout; verify payment; handle PayMongo webhook; refund flow |
    | `match-actions.ts` (25KB) | Create match; record score; ELO update; match completion |
    | `reservations.ts` (20KB) | Create reservation; cancel; reschedule; conflict detection |
    | `court-admin-actions.ts` (37KB) | CRUD venues/courts; availability management; approval/rejection |
    | `refund-actions.ts` (23KB) | Request refund; approve/deny; partial refund |
    | `global-admin-*` | User management; moderation; settings changes; audit logging |
    | `profile-actions.ts` | Update profile; change avatar; validation |
    | `review-actions.ts` | Submit review; edit; admin response |

    **Strategy:** Mock `createServerClient` from `@supabase/ssr` to return a mock Supabase client. Test the business logic, not the database.

    **Directory:** `web/src/app/actions/__tests__/`

    ---

    #### 4.2.2 API Routes (Web)

    | Route | Test |
    |---|---|
    | `api/mobile/create-checkout` | Valid payload → checkout URL; invalid → 400 |
    | `api/mobile/create-reservation` | Conflict detection; auth check |
    | `api/mobile/cancel-reservation` | Status transition; refund trigger |
    | `api/mobile/validate-booking` | Availability check |
    | `api/mobile/validate-discount` | Valid/expired/invalid codes |
    | `api/webhooks` | PayMongo signature verification; idempotency |
    | `api/cron` | Session auto-close timing |

    **Directory:** `web/src/app/api/__tests__/`

    ---

    #### 4.2.3 Custom Hooks (Web)

    Test with `renderHook` from React Testing Library.

    | Hook | Test |
    |---|---|
    | `use-queue` | Fetches queue data; handles join/leave; polling behavior |
    | `use-auth` | Returns user on valid session; null on no session |
    | `use-queue-notifications` | Triggers on queue status change |
    | `use-server-time` | Returns synced time; handles network error |

    **Directory:** `web/src/hooks/__tests__/`

    ---

    ### 4.3 Component Tests (Web) 🟠

    Test key interactive components, not every styled div.

    | Component Area | What to Test |
    |---|---|
    | **Auth forms** | Login/signup form submission; validation errors displayed; redirect after success |
    | **Queue dashboard** | Status badge renders correctly; join button disabled when appropriate |
    | **Booking flow** | Court selection → date → time → payment; form state transitions |
    | **Admin panels** | Table renders data; action buttons trigger correct callbacks |
    | **Map components** | Map renders (mock Leaflet); marker click events |

    **Directory:** `web/src/components/__tests__/`

    ---

    ### 4.4 E2E Tests (Web) 🔴

    Few but critical. Run against a local Supabase instance.

    | Flow | Steps |
    |---|---|
    | **Signup → Login** | Fill form → submit → verify redirect → verify session |
    | **Browse Courts → Book** | Search → filter → select court → pick slot → pay → confirmation |
    | **Queue Session Lifecycle** | QM creates session → player joins → match starts → score recorded → session completes |
    | **Court Admin: Manage Venue** | Login as admin → create venue → add court → set availability → approve queue request |
    | **Payment → Refund** | Complete booking → request refund → admin approves → verify refund status |

    **Directory:** `web/e2e/`

    ---

    ### 4.5 Backend / Database Tests

    | Area | How |
    |---|---|
    | **Migrations** | `supabase db reset` on a local instance succeeds without errors |
    | **Seed data** | After reset, verify seed data exists via SQL assertions |
    | **Edge functions** | Test `auto-close-sessions` function with test data; verify status transitions |
    | **RLS policies** | Test that players can't access admin data; admins can't access other venues |

    ---

    ## 5. Implementation Order (Phased)

    ### Phase 1: Foundation (Week 1)

    - [ ] Install Vitest + config in `shared/`, `web/`
    - [ ] Write all `shared/` validation tests (~50 test cases)
    - [ ] Write all `shared/` utility tests (~40 test cases)
    - [ ] Write `queue-status.ts` tests (~25 test cases)
    - [ ] Write `rate-limiter.ts` tests (~15 test cases)
    - [ ] Add `test` scripts to root + workspace `package.json`

    ### Phase 2: Business Logic (Week 2-3)

    - [ ] Set up Supabase client mock factory
    - [ ] Write `queue-actions` tests (highest complexity)
    - [ ] Write `payments` + `refund-actions` tests
    - [ ] Write `reservations` + `match-actions` tests
    - [ ] Write remaining server action tests
    - [ ] Write Zustand store tests (web + mobile)

    ### Phase 3: Components & Hooks (Week 3-4)

    - [ ] Install React Testing Library
    - [ ] Write hook tests (`use-queue`, `use-auth`, etc.)
    - [ ] Write critical component tests (auth forms, booking flow)
    - [ ] Write API route tests

    ### Phase 4: E2E & CI (Week 4-5)

    - [ ] Install Playwright
    - [ ] Set up local Supabase for E2E
    - [ ] Write 5 critical E2E flows
    - [ ] Configure GitHub Actions CI pipeline
    - [ ] Add coverage reporting

    ---

    ## 6. CI/CD Integration

    ```yaml
    # .github/workflows/test.yml (suggested)
    name: Tests
    on: [push, pull_request]

    jobs:
    unit-integration:
        runs-on: ubuntu-latest
        steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
            with: { node-version: '18' }
        - run: npm ci
        - run: npm test -- --coverage

    e2e:
        runs-on: ubuntu-latest
        needs: unit-integration
        steps:
        - uses: actions/checkout@v4
        - uses: supabase/setup-cli@v1
        - run: supabase start
        - run: npx playwright install --with-deps
        - run: npx playwright test
    ```

    ---

    ## 7. Coverage Targets

    | Phase | Target |
    |---|---|
    | Phase 1 | 100% of `shared/` functions and validations |
    | Phase 2 | 80%+ of server action business logic branches |
    | Phase 3 | Key interactive components covered |
    | Phase 4 | 5 critical user journeys covered E2E |
    | **Long-term** | **70% overall line coverage** |

    ---

    ## 8. Key Decisions for Your Review

    > [!IMPORTANT]
    > **Vitest vs Jest:** I recommend **Vitest** for `shared/` and `web/` because it's faster and has native ESM/TypeScript support matching your Next.js 16 setup. Mobile can keep Jest (standard for Expo). Do you have a preference?

    > [!IMPORTANT]
    > **E2E scope:** The 5 flows above cover the most critical user journeys. Would you like more E2E coverage for admin features, or is the admin panel lower priority?

    > [!IMPORTANT]
    > **Mobile testing depth:** With Expo 54, component tests are feasible. However, E2E testing on mobile (Maestro/Detox) requires device simulators. Would you like to include mobile E2E in this plan, or focus on web first?

    ---

    ## Document Version

    - **Version:** 1.0
    - **Last Updated:** 2025-01-27
    - **Author:** Testing Plan Team
    - **Status:** Draft for Review
