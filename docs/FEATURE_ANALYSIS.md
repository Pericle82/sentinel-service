# Feature-First Analysis (Source Repo → Greenfield)

This document captures **what** the existing repository appears to support.
It intentionally avoids **how** it is implemented.

## Functional Features (User-Visible)

### Authentication & Identity
- User authentication via OpenID Connect (Keycloak / OAuth2/OIDC).
- “Current user” endpoint (e.g. `/me`) returning authenticated state + roles.

### Authorization (RBAC)
- Role-based access control with granular permissions.
- Permissions cover workout programs, training sessions, clients, and admin capabilities.

### Users & Profiles
- Core user records.
- Extended user profile data (separate store is implied).

### Subscriptions & Limits
- Subscription plans/tiers.
- Subscription limits/quotas by resource type (e.g. workout-programs, clients, AI credits).
- User resource usage tracking for quota enforcement.

### Trainer ↔ Client Relationship
- Trainer-client relationship workflow (request/accept implied by docs).
- Trainer operations on behalf of clients (e.g. create/assign programs and sessions).

### Exercise Library
- System exercise catalog.
- Support for trainer custom exercises.

### Workout Programs (Primary Domain)
- CRUD for workout programs.
- Program lifecycle: `draft → published → active → completed|cancelled` (and additional states appear in docs like paused/abandoned).
- Program assignment: trainer can create draft (unassigned) and later assign to an owner.
- Program visibility separate from lifecycle (private/shared/public).
- Program statistics endpoint.
- Program deletion:
  - Regular delete (blocked by in-progress sessions).
  - Force delete (auto-completes user’s in-progress sessions, then deletes everything).

### Training Sessions
- Create session for a specific program week/day and scheduled date.
- Session lifecycle: `scheduled → in_progress → completed|skipped|cancelled` (cancel is referenced in workflow docs).
- Find existing session (avoid duplicates by week/day).
- Start session.
- Complete session.
- Skip session.
- Session detail can include: exercise logs, context, metrics, ML snapshot.
- Prevent redoing completed days.

### Exercise Logging & Session Analytics
- Exercise logs capturing planned vs actual sets.
- Session context (sleep, stress, motivation, etc.).
- Progression metrics.
- User/session statistics endpoints.

### Notifications
- User notifications for events.

### Activity / Event Stream
- Activity events emitted by multiple domains (training sessions, trainer-client, workout programs).
- Visibility rules for activity events (shared helper referenced in docs).

### Admin Operations
- Admin management of users.
- Admin management of background jobs/cron execution.

## Cross-Cutting / Technical Features

### API
- Versioned REST API (`/api/v1`).
- API documentation generation is implied (OpenAPI/TSOA references).

### Data Storage
- PostgreSQL for core relational data.
- Additional datastore is implied for profiles and/or exercise identifiers (MongoDB referenced).
- Migrations are SQL-based.

### Caching
- Redis-based caching (cache-aside and middleware patterns are described).
- TTL strategy by endpoint type.
- User-specific caching support (optional pattern).
- Cache invalidation after mutations.

### Sessions & Security
- Session-based authentication is implied (server-side session store backed by Redis is referenced).
- Session security hardening:
  - IP binding monitoring
  - User-Agent fingerprinting
  - inactivity tracking
  - optional re-auth / invalidation strategies

### Platform Security
- CORS policy.
- Helmet or equivalent.
- Rate limiting.
- Trust proxy configuration behind reverse proxies.

### Observability
- Structured logging.
- Warnings/metrics around suspicious session changes are implied.

### Background Processing
- Cron scheduler and admin-triggered job management endpoints.

### Testing
- Unit and integration test tiers (integration uses Dockerized dependencies).

### Dev Infrastructure
- Docker Compose stack including Postgres, Redis, MongoDB, Keycloak, and Nginx reverse proxy.

## Inferred Domain Nouns (Candidate Aggregate/Entity Names)

- User
- UserProfile
- Subscription
- SubscriptionLimit
- UserResourceUsage
- Role / Permission
- TrainerClientRelationship
- Exercise
- WorkoutProgram
- WorkoutProgramWeek
- WorkoutProgramDay
- WorkoutProgramExercise
- PlannedSet
- TrainingSession
- ExerciseLog
- SessionContext
- ProgressionMetric
- MlSnapshot
- Notification
- ActivityEvent

## Open Questions (To Resolve Before Migration)

- What is the canonical source of truth for users and roles (Keycloak vs local DB)?
- Are sessions cookie-based only, or is bearer-token auth also supported/required?
- Which workout program states are truly supported and which are historical (paused/abandoned vs cancelled)?
- What are the exact permission names and which endpoints require which permissions?
- What are the subscription tiers and their quota rules (resources, reset periods)?
- What is the expected behavior for CORS when no allowlist is configured?
- Which parts must be strongly consistent (transactions) vs best-effort (cache writes, activity events)?
- What does “ML snapshots” mean operationally (storage, retention, eligibility thresholds, privacy)?

## Notes on Scope for Greenfield

- Features explicitly marked as future/TODO in the source repo should be treated as **backlog**, not baseline.
- Prefer minimal viable slices: implement the domain rules first, then persistence, then HTTP.
