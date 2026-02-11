# Chess Tournament Manager - Implementation Plan

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Database Design](#database-design)
3. [Implementation Phases](#implementation-phases)
4. [Claude Code Prompting Guide](#claude-code-prompting-guide)
5. [Testing Strategy](#testing-strategy)
6. [Risk Mitigation](#risk-mitigation)

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Next.js   │  │     PWA     │  │   Mobile    │             │
│  │   Web App   │  │   Support   │  │ Responsive  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    Auth     │  │Rate Limiting│  │   Caching   │             │
│  │ Middleware  │  │             │  │   Layer     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│      Core API Service       │ │    Scraping Service         │
├─────────────────────────────┤ ├─────────────────────────────┤
│  ┌───────────────────────┐  │ │  ┌───────────────────────┐  │
│  │  Tournament Manager   │  │ │  │   Scraper Engine     │  │
│  ├───────────────────────┤  │ │  ├───────────────────────┤  │
│  │   Player Tracker      │  │ │  │   Queue Manager      │  │
│  ├───────────────────────┤  │ │  ├───────────────────────┤  │
│  │  Notification Service │  │ │  │   Data Transformer   │  │
│  └───────────────────────┘  │ │  └───────────────────────┘  │
└─────────────────────────────┘ └─────────────────────────────┘
                │                             │
                └──────────────┬──────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ PostgreSQL  │  │    Redis    │  │   S3/CDN    │             │
│  │  Database   │  │    Cache    │  │   Storage   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### Component Details

| Component | Technology | Purpose |
|-----------|------------|---------|
| Web Frontend | Next.js 14+ | Server-side rendering, SEO optimization |
| API Gateway | Express/Fastify | Request routing, middleware management |
| Core API | Node.js + TypeScript | Business logic, data processing |
| Scraping Service | Playwright | Web scraping, data extraction |
| Queue System | BullMQ | Job scheduling, retry logic |
| Primary Database | PostgreSQL | Persistent data storage |
| Cache Layer | Redis | Performance optimization |
| Real-time Updates | SSE/WebSockets | Live tournament updates |

## Database Design

### Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Tournament    │     │     Player      │     │      User       │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ chess_results_id│     │ fide_id         │     │ email           │
│ name            │     │ name            │     │ username        │
│ location        │     │ title           │     │ password_hash   │
│ start_date      │     │ federation      │     │ created_at      │
│ end_date        │     │ rating          │     │ preferences     │
│ rounds_total    │     │ club            │     └─────────────────┘
│ time_control    │     │ created_at      │              │
│ status          │     │ updated_at      │              │
│ created_at      │     └─────────────────┘              │
│ updated_at      │              │                       │
└─────────────────┘              │                       │
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ TournamentPlayer│     │     Pairing     │     │   UserFollow    │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ tournament_id   │◄────┤ tournament_id   │     │ user_id         │
│ player_id       │     │ round           │     │ player_id       │
│ starting_rank   │     │ board           │     │ tournament_id   │
│ current_points  │     │ white_player_id │     │ created_at      │
│ performance     │     │ black_player_id │     └─────────────────┘
│ tiebreak1       │     │ result          │              │
│ tiebreak2       │     │ created_at      │              │
│ final_rank      │     └─────────────────┘              ▼
└─────────────────┘                              ┌─────────────────┐
                                                 │  Notification   │
                                                 ├─────────────────┤
                                                 │ id              │
                                                 │ user_id         │
                                                 │ type            │
                                                 │ data            │
                                                 │ read            │
                                                 │ created_at      │
                                                 └─────────────────┘
```

### Database Tables

#### tournaments
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| chess_results_id | VARCHAR(20) | UNIQUE, NOT NULL | Chess-results tournament ID |
| name | VARCHAR(255) | NOT NULL | Tournament name |
| location | VARCHAR(255) | | Tournament location |
| start_date | DATE | NOT NULL | Start date |
| end_date | DATE | | End date |
| rounds_total | INTEGER | NOT NULL | Total rounds |
| current_round | INTEGER | DEFAULT 0 | Current round |
| time_control | VARCHAR(100) | | Time control description |
| arbiter | VARCHAR(255) | | Chief arbiter name |
| status | ENUM | NOT NULL | active, completed, upcoming |
| last_scraped | TIMESTAMP | | Last scraping time |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

#### players
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| fide_id | VARCHAR(20) | UNIQUE | FIDE ID if available |
| name | VARCHAR(255) | NOT NULL | Player full name |
| title | VARCHAR(10) | | Chess title (GM, IM, etc.) |
| federation | VARCHAR(3) | | Country code |
| rating | INTEGER | | Current rating |
| club | VARCHAR(255) | | Club/City |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

#### pairings
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| tournament_id | UUID | FOREIGN KEY | References tournaments(id) |
| round | INTEGER | NOT NULL | Round number |
| board | INTEGER | NOT NULL | Board number |
| white_player_id | UUID | FOREIGN KEY | References players(id) |
| black_player_id | UUID | FOREIGN KEY | References players(id) |
| result | VARCHAR(10) | | 1-0, 0-1, 1/2-1/2, etc. |
| pgn | TEXT | | Game PGN if available |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | DEFAULT NOW() | |

## Implementation Phases

### Phase 1: Foundation (Days 1-3)
**Goal**: Set up project infrastructure and basic scraping

#### Day 1: Project Setup
- Initialize Next.js project with TypeScript
- Set up ESLint, Prettier, and Git hooks
- Configure Tailwind CSS and Shadcn/ui
- Create basic folder structure
- Set up environment variables

#### Day 2: Database and Backend Setup
- Set up PostgreSQL with Prisma
- Create database schema
- Initialize Express/Fastify server
- Set up basic API structure
- Configure Redis connection

#### Day 3: Scraping Service Foundation
- Set up Playwright for scraping
- Create scraper base class
- Implement chess-results.com parser
- Test basic data extraction

### Phase 2: Core Features (Days 4-7)
**Goal**: Implement core tournament tracking functionality

#### Day 4: Tournament Management
- Tournament CRUD operations
- Tournament list API
- Basic tournament detail page
- Search functionality

#### Day 5: Player and Pairing Management
- Player data management
- Pairing extraction and storage
- Round-by-round navigation
- Results tracking

#### Day 6: Real-time Updates
- Implement BullMQ job queue
- Schedule periodic scraping
- Add SSE/WebSocket support
- Live update UI components

#### Day 7: UI Enhancement
- Responsive tournament views
- Modern standings table
- Player detail pages
- Dark/light theme support

### Phase 3: Advanced Features (Days 8-10)
**Goal**: Add user features and notifications

#### Day 8: User System
- Authentication (NextAuth.js)
- User registration/login
- User preferences
- Following system

#### Day 9: Notifications
- Web Push notifications setup
- Email notifications (optional)
- In-app notification center
- Notification preferences

#### Day 10: Analytics and Export
- Performance calculations
- Statistics dashboard
- Data export features
- Share functionality

### Phase 4: Polish and Deploy (Days 11-12)
**Goal**: Testing, optimization, and deployment

#### Day 11: Testing and Optimization
- Unit tests for critical paths
- E2E tests for main flows
- Performance optimization
- Error handling improvements

#### Day 12: Deployment
- Set up CI/CD pipeline
- Deploy to production
- Configure monitoring
- Documentation finalization

## Claude Code Prompting Guide

### General Principles
1. **One feature per session**: Focus on a single component/feature
2. **Provide context**: Always share relevant existing code
3. **Test incrementally**: Ask for tests after each implementation
4. **Review before commit**: Always review generated code

### Prompt Templates

#### 1. Project Initialization
```
Create a new Next.js 14 project with:
- TypeScript
- Tailwind CSS
- App Router
- ESLint and Prettier configured
- Shadcn/ui setup
- Basic folder structure: /app, /components, /lib, /types
Include a .env.example file with necessary variables.
```

#### 2. Database Schema
```
Create Prisma schema for chess tournament tracking with these entities:
[Paste entity descriptions from database design section]
Include proper indexes for performance.
Generate TypeScript types after schema creation.
```

#### 3. Scraping Service
```
Create a web scraping service using Playwright that:
1. Scrapes chess-results.com tournament data
2. Handles these URL patterns: [list patterns]
3. Implements retry logic and error handling
4. Transforms scraped data to match our database schema
Test with tournament URL: https://s1.chess-results.com/tnr1233866.aspx
```

#### 4. API Endpoints
```
Create REST API endpoint for [specific feature]:
- Route: [endpoint path]
- Method: [GET/POST/PUT/DELETE]
- Input validation using Zod
- Error handling with proper status codes
- Include TypeScript types
- Add basic unit tests
```

#### 5. React Components
```
Create a React component for [component name]:
- Use TypeScript and Tailwind CSS
- Make it responsive
- Use Shadcn/ui components where appropriate
- Include loading and error states
- Add proper accessibility attributes
Here's the design reference: [description or mockup]
```

#### 6. Feature Implementation
```
Implement [feature name] with these requirements:
1. [Requirement 1]
2. [Requirement 2]
Current code context:
[Paste relevant existing code]
Follow existing patterns and conventions.
```

### Testing Prompts

#### Unit Tests
```
Write unit tests for [component/function]:
- Use Jest and React Testing Library
- Cover main use cases and edge cases
- Include error scenarios
- Aim for 80%+ coverage
Current implementation: [paste code]
```

#### Integration Tests
```
Create integration tests for [feature]:
- Test API endpoints with supertest
- Include database interactions
- Test both success and failure paths
```

### Code Review Prompts
```
Review this code for:
1. TypeScript type safety
2. Potential bugs
3. Performance issues
4. Security concerns
5. Code style consistency
Suggest improvements where needed.
[Paste code to review]
```

## Testing Strategy

### Testing Pyramid

```
         ┌─────┐
        /  E2E  \      5%  - Critical user flows
       /─────────\
      /Integration\    20% - API and service tests  
     /─────────────\
    /     Unit      \  75% - Component and function tests
   /─────────────────\
```

### Test Coverage Goals
- Overall: 80%+
- Critical paths: 95%+
- UI Components: 70%+
- API endpoints: 90%+
- Scraping logic: 85%+

### Testing Tools
- **Unit**: Jest, React Testing Library
- **Integration**: Supertest, Prisma test client
- **E2E**: Playwright
- **Performance**: Lighthouse CI

## Risk Mitigation

### Technical Risks

| Risk | Mitigation Strategy |
|------|-------------------|
| Chess-results.com blocks scraping | Implement rotating user agents, respect robots.txt, add delays |
| Database performance issues | Add proper indexes, implement caching, pagination |
| Real-time updates overload | Rate limiting, efficient WebSocket management |
| Data inconsistency | Transaction management, validation layers |

### Development Risks

| Risk | Mitigation Strategy |
|------|-------------------|
| Scope creep | Strict phase adherence, MVP focus |
| Token limit issues | Break down complex features, clear context |
| Testing gaps | Test-first development, coverage requirements |
| Deployment issues | Staging environment, gradual rollout |

### Monitoring and Alerts

1. **Application Monitoring**
   - Sentry for error tracking
   - Custom metrics for scraping success rate
   - API response time monitoring

2. **Infrastructure Monitoring**
   - Database connection pool metrics
   - Redis memory usage
   - Server resource utilization

3. **Business Metrics**
   - Active users
   - Tournaments tracked
   - Notification delivery rate

## Next Steps

1. Review and approve this implementation plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Daily progress reviews
5. Adjust plan based on learnings