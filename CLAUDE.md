# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chess Tournament Manager is a modern web application for tracking chess tournaments from chess-results.com. It provides real-time updates, player following, notifications, and enhanced viewing experiences for chess tournament data.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Node.js, Express/Fastify, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Web Scraping**: Playwright
- **Queue**: BullMQ
- **Real-time**: Server-Sent Events (SSE) / WebSockets

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)**: Complete development roadmap and architecture
- **[API Specification](./docs/API_SPECIFICATION.md)**: Detailed REST API endpoints
- **[UI/UX Design](./docs/UI_UX_DESIGN.md)**: Design system and component guidelines
- **[Data Flow Diagrams](./docs/DATA_FLOW_DIAGRAMS.md)**: System data flow visualizations

## Common Commands

```bash
# Install dependencies
npm install

# Development
npm run dev          # Start Next.js dev server
npm run dev:api      # Start API server
npm run dev:worker   # Start scraping worker

# Database
npm run db:migrate   # Run database migrations
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio

# Testing
npm run test         # Run unit tests
npm run test:e2e     # Run E2E tests
npm run test:watch   # Run tests in watch mode

# Code Quality
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks
npm run format       # Format code with Prettier

# Build
npm run build        # Build for production
npm run start        # Start production server
```

## Project Structure

```
chess-manager/
├── /app                 # Next.js app directory
│   ├── /api            # API routes
│   ├── /tournaments    # Tournament pages
│   └── /players        # Player pages
├── /components         # React components
│   ├── /ui            # Base UI components (Shadcn)
│   └── /features      # Feature-specific components
├── /lib               # Shared utilities
│   ├── /api          # API client
│   ├── /db           # Database utilities
│   └── /utils        # Helper functions
├── /server            # Backend code
│   ├── /api          # Express/Fastify routes
│   ├── /services     # Business logic
│   ├── /workers      # Background job workers
│   └── /scrapers     # Web scraping logic
├── /prisma            # Database schema
├── /public            # Static assets
├── /docs              # Documentation
└── /tests             # Test files
```

## Key Features

1. **Tournament Tracking**: Import and track tournaments from chess-results.com
2. **Live Updates**: Real-time tournament updates via SSE/WebSocket
3. **Player Following**: Follow specific players across tournaments
4. **Notifications**: Push notifications for followed players/tournaments
5. **Modern UI**: Responsive design with dark/light themes
6. **Data Export**: Export tournament data in various formats (PGN, CSV)
7. **Search & Filter**: Advanced search with filters
8. **Analytics**: Performance calculations and statistics

## Testing Requirements (MANDATORY)

On **every code change**, before committing:

1. **Run unit tests**: `npm test` — must pass 100%
2. **Run affected e2e tests**: `npm run test:e2e -- --grep "<affected area>"` for the changed feature
3. **Run full e2e sanity**: `npm run test:e2e` — must pass 100%
4. **Add e2e tests** for any new UI flows, navigation, or user-visible behavior

**E2E test files by area:**
- Navigation/layout → `tests/e2e/navigation.spec.ts`
- Tournament list → `tests/e2e/tournaments-list.spec.ts`
- Tournament detail (tabs, standings, pairings) → `tests/e2e/tournament-detail.spec.ts`
- Tournament import → `tests/e2e/tournament-import.spec.ts`
- Players list + search → `tests/e2e/players.spec.ts`
- Player tournament page (tabs, links, stats) → `tests/e2e/player-tournament-page.spec.ts`
- Auth pages → `tests/e2e/auth-pages.spec.ts`
- API endpoints → `tests/e2e/api-endpoints.spec.ts`
- Responsive/mobile → `tests/e2e/responsive.spec.ts`

**Never merge with failing tests.**

## Development Workflow

1. **Feature Development**:
   - Create feature branch from `main`
   - Implement feature following existing patterns
   - Write tests for new functionality
   - Ensure linting and type checking pass
   - Create PR with detailed description

2. **Code Style**:
   - Follow TypeScript best practices
   - Use functional components with hooks
   - Implement proper error handling
   - Add loading and error states
   - Ensure accessibility compliance

3. **Testing Strategy**:
   - Unit tests for utilities and components
   - Integration tests for API endpoints
   - E2E tests for critical user flows
   - Aim for >80% code coverage

## Scraping Guidelines

When scraping chess-results.com:
- Respect robots.txt
- Add delays between requests (2-5 seconds)
- Use rotating user agents
- Handle errors gracefully
- Cache responses to minimize requests

## Environment Variables

Required environment variables (see `.env.example`):
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
NEXTAUTH_SECRET=...
NEXT_PUBLIC_API_URL=...
```

## Deployment

The application is designed to be deployed on:
- **Frontend**: Vercel
- **Backend**: Railway/Render
- **Database**: Supabase/Neon
- **Redis**: Upstash

## Performance Considerations

- Implement proper caching strategies
- Use pagination for large datasets
- Optimize database queries with indexes
- Lazy load components and images
- Use virtualization for long lists

## Security

- Sanitize all user inputs
- Implement rate limiting
- Use HTTPS everywhere
- Follow OWASP guidelines
- Regular dependency updates