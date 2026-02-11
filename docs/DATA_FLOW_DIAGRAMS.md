# Chess Tournament Manager - Data Flow Diagrams

## Overview

This document describes how data flows through the Chess Tournament Manager system for various operations.

## 1. Tournament Import Flow

```
User                    Frontend              API Gateway           Core API              Scraping Service       Chess-Results
  │                        │                      │                     │                      │                    │
  ├─ Enter Tournament URL ─►                     │                     │                      │                    │
  │                        ├─ POST /import ──────►                     │                      │                    │
  │                        │                      ├─ Validate URL ─────►                      │                    │
  │                        │                      │                     ├─ Create Import Job ──►                    │
  │                        │◄─ 202 Accepted ─────┤◄─ Job ID ──────────┤                      │                    │
  │                        │                      │                     │                      ├─ Fetch HTML ──────►
  │                        │                      │                     │                      │◄─ HTML Response ───┤
  │                        │                      │                     │                      ├─ Parse Tournament ─┤
  │                        │                      │                     │                      ├─ Parse Players ────┤
  │                        │                      │                     │                      ├─ Parse Pairings ───┤
  │                        │                      │                     │◄─ Tournament Data ───┤                    │
  │                        │                      │                     ├─ Store in DB ────────┤                    │
  │                        │                      │                     ├─ Emit Update Event ──┤                    │
  │◄─ Push Notification ───┤◄─ SSE: Import Done ─┤◄─ Tournament Ready ─┤                      │                    │
  │                        │                      │                     │                      │                    │
```

### Steps:
1. User submits tournament URL
2. API validates URL format and creates import job
3. Scraping service fetches HTML from chess-results.com
4. Parser extracts tournament data, players, and pairings
5. Data is transformed and stored in database
6. Real-time update sent to user via SSE/WebSocket

## 2. Live Tournament Update Flow

```
Scheduler              Queue Manager         Scraping Worker        Database            Cache              SSE/WS Server
    │                      │                      │                    │                   │                    │
    ├─ Cron Trigger ──────►                      │                    │                   │                    │
    │                      ├─ Get Active ─────────┤──────────────────►│                   │                    │
    │                      │  Tournaments         │                    │                   │                    │
    │                      │◄─ Tournament List ───┤◄──────────────────┤                   │                    │
    │                      │                      │                    │                   │                    │
    │                      ├─ Create Update Jobs ─┤                    │                   │                    │
    │                      │  (Batch)             │                    │                   │                    │
    │                      ├─ Dispatch Job ──────►                    │                   │                    │
    │                      │                      ├─ Check Cache ──────┤──────────────────►│                    │
    │                      │                      │◄─ Last Update ─────┤◄──────────────────┤                    │
    │                      │                      │                    │                   │                    │
    │                      │                      ├─ Fetch Updates ────┤─► Chess-Results   │                    │
    │                      │                      │◄─ New Data ────────┤◄─                 │                    │
    │                      │                      │                    │                   │                    │
    │                      │                      ├─ Compare Data ─────┤                   │                    │
    │                      │                      │  (Diff Check)      │                   │                    │
    │                      │                      │                    │                   │                    │
    │                      │                      ├─ Update Records ───►                   │                    │
    │                      │                      │                    │                   ├─ Invalidate ───────┤
    │                      │                      │                    │                   │                    │
    │                      │                      ├─ Emit Events ──────┤──────────────────┤───────────────────►
    │                      │                      │                    │                   │                    ├─► Users
    │                      │◄─ Job Complete ──────┤                    │                   │                    │
```

### Update Intervals:
- Active tournaments: Every 2-5 minutes
- Upcoming tournaments: Every hour
- Completed tournaments: Once daily

## 3. User Notification Flow

```
Event Source           Event Bus            Notification Service      Database           Push Service         User Devices
     │                    │                        │                    │                    │                    │
     ├─ Game Result ──────►                        │                    │                    │                    │
     │  Event             ├─ Process Event ────────►                    │                    │                    │
     │                    │                        ├─ Get Subscribers ──►                    │                    │
     │                    │                        │◄─ User List ────────┤                    │                    │
     │                    │                        │                    │                    │                    │
     │                    │                        ├─ Filter Rules ─────┤                    │                    │
     │                    │                        │  (Preferences)     │                    │                    │
     │                    │                        │                    │                    │                    │
     │                    │                        ├─ Create ───────────►                    │                    │
     │                    │                        │  Notifications     │                    │                    │
     │                    │                        │                    │                    │                    │
     │                    │                        ├─ Queue Push ───────┤───────────────────►                    │
     │                    │                        │  Notifications     │                    ├─ Send to FCM ──────►
     │                    │                        │                    │                    │                    ├─► Mobile
     │                    │                        │                    │                    ├─ Send to Web Push ─►
     │                    │                        │                    │                    │                    ├─► Browser
     │                    │                        ├─ Store in DB ───────►                    │                    │
     │                    │                        │                    │                    │                    │
     │                    │                        ├─ Send In-App ──────┤────────────────────┤────────────────────┤
     │                    │                        │  via SSE/WS        │                    │                    ├─► Web App
```

### Notification Types:
1. **Player Events**: Game start/end, round results
2. **Tournament Events**: Round start, standings update
3. **System Events**: Import complete, errors

## 4. Player Following Flow

```
User               Frontend            API                Database           Cache            Real-time Updates
 │                   │                  │                    │                 │                    │
 ├─ Click Follow ────►                  │                    │                 │                    │
 │                   ├─ POST /follow ───►                    │                 │                    │
 │                   │                  ├─ Check Auth ───────┤                 │                    │
 │                   │                  ├─ Validate Player ──►                 │                    │
 │                   │                  │◄─ Player Exists ────┤                 │                    │
 │                   │                  │                    │                 │                    │
 │                   │                  ├─ Create Follow ────►                 │                    │
 │                   │                  │  Record            │                 │                    │
 │                   │                  │                    │                 │                    │
 │                   │                  ├─ Update Cache ─────┤─────────────────►                    │
 │                   │                  │  (User Follows)    │                 │                    │
 │                   │                  │                    │                 │                    │
 │                   │                  ├─ Subscribe to ─────┤─────────────────┤────────────────────►
 │                   │                  │  Player Events     │                 │                    │
 │                   │◄─ 200 OK ────────┤                    │                 │                    │
 │◄─ Update UI ──────┤                  │                    │                 │                    │
 │                   │                  │                    │                 │                    │
 │                   │◄─────────────────┤────────────────────┤─────────────────┤◄─ Player Updates ───┤
 │◄─ Notifications ──┤  SSE/WebSocket   │                    │                 │   (Games, Results)  │
```

## 5. Search and Filter Flow

```
User             Frontend           API Gateway          Search Service         Database            Cache
 │                  │                   │                      │                   │                 │
 ├─ Type Search ────►                   │                      │                   │                 │
 │  "Magnus"        ├─ Debounce ────────┤                      │                   │                 │
 │                  │  (300ms)          │                      │                   │                 │
 │                  ├─ GET /search ─────►                      │                   │                 │
 │                  │  ?q=Magnus        ├─ Check Cache ────────┤───────────────────┤─────────────────►
 │                  │                   │                      │                   │◄─ Cache Miss ────┤
 │                  │                   │                      │                   │                 │
 │                  │                   ├─ Parse Query ────────►                   │                 │
 │                  │                   │                      ├─ Build SQL ───────►                 │
 │                  │                   │                      │  Query            │                 │
 │                  │                   │                      │◄─ Results ─────────┤                 │
 │                  │                   │                      │                   │                 │
 │                  │                   │                      ├─ Rank Results ────┤                 │
 │                  │                   │                      │  (Relevance)      │                 │
 │                  │                   │                      │                   │                 │
 │                  │                   │◄─ Search Results ────┤                   │                 │
 │                  │                   ├─ Cache Results ──────┤───────────────────┤─────────────────►
 │                  │◄─ 200 OK ─────────┤                      │                   │                 │
 │◄─ Show Results ──┤                   │                      │                   │                 │
```

### Search Features:
- Auto-complete with debouncing
- Fuzzy matching for names
- Filter by federation, rating, title
- Recent searches cached

## 6. Data Export Flow

```
User              Frontend             API               Export Service        Storage            Email Service
 │                  │                   │                      │                 │                    │
 ├─ Request Export ─►                   │                      │                 │                    │
 │  (PGN/CSV)       ├─ POST /export ────►                      │                 │                    │
 │                  │                   ├─ Validate Request ───►                 │                    │
 │                  │                   ├─ Create Export Job ──►                 │                    │
 │                  │◄─ 202 Accepted ───┤                      │                 │                    │
 │                  │   (Job ID)        │                      │                 │                    │
 │                  │                   │                      ├─ Fetch Data ────┤                    │
 │                  │                   │                      │◄─ Tournament ───┤                    │
 │                  │                   │                      │   Data          │                    │
 │                  │                   │                      │                 │                    │
 │                  │                   │                      ├─ Generate File ─┤                    │
 │                  │                   │                      │  (PGN/CSV)      │                    │
 │                  │                   │                      │                 │                    │
 │                  │                   │                      ├─ Upload to S3 ──►                    │
 │                  │                   │                      │                 │                    │
 │                  │                   │                      ├─ Generate URL ──┤                    │
 │                  │                   │                      │  (Signed, 24h)  │                    │
 │                  │                   │                      │                 │                    │
 │                  │◄─ SSE: Complete ──┤◄─ Export Ready ──────┤                 │                    │
 │                  │                   │                      ├─ Send Email ────┤────────────────────►
 │◄─ Download Link ─┤                   │                      │  (Optional)     │                    ├─► User Email
 │                  │                   │                      │                 │                    │
```

### Export Formats:
- **PGN**: Chess games in Portable Game Notation
- **CSV**: Standings, pairings, player lists
- **JSON**: Raw data for developers
- **PDF**: Tournament reports (future)

## 7. Authentication Flow

```
User              Frontend            Auth Service         Database           JWT Service         Session Store
 │                  │                     │                   │                   │                    │
 ├─ Enter Creds ────►                     │                   │                   │                    │
 │                  ├─ POST /login ───────►                   │                   │                    │
 │                  │                     ├─ Validate ────────►                   │                    │
 │                  │                     │  Credentials      │                   │                    │
 │                  │                     │◄─ User Found ──────┤                   │                    │
 │                  │                     │                   │                   │                    │
 │                  │                     ├─ Hash Password ────┤                   │                    │
 │                  │                     ├─ Compare ──────────┤                   │                    │
 │                  │                     │                   │                   │                    │
 │                  │                     ├─ Generate JWT ────┤───────────────────►                    │
 │                  │                     │◄─ Token ───────────┤◄──────────────────┤                    │
 │                  │                     │                   │                   │                    │
 │                  │                     ├─ Create Session ───┤───────────────────┤────────────────────►
 │                  │                     │                   │                   │                    │
 │                  │◄─ 200 OK ───────────┤                   │                   │                    │
 │                  │   (Token + User)    │                   │                   │                    │
 │◄─ Store Token ───┤                     │                   │                   │                    │
 │   (LocalStorage) │                     │                   │                   │                    │
```

### Token Management:
- Access Token: 15 minutes expiry
- Refresh Token: 7 days expiry
- Automatic renewal on activity

## 8. Error Handling Flow

```
Component           Error Boundary        Logger              Sentry             Alert System         Support
    │                    │                  │                   │                    │                 │
    ├─ Error Thrown ─────►                  │                   │                    │                 │
    │                    ├─ Catch Error ────►                   │                    │                 │
    │                    │                  ├─ Log Locally ─────┤                    │                 │
    │                    │                  ├─ Send to Sentry ──►                    │                 │
    │                    │                  │                   ├─ Track Error ──────┤                 │
    │                    │                  │                   │                    │                 │
    │                    ├─ Check Severity ─┤                   │                    │                 │
    │                    │                  │                   │                    │                 │
    │                    ├─ Show User ──────┤                   │                    │                 │
    │◄─ Fallback UI ─────┤  Message        │                   │                    │                 │
    │                    │                  │                   ├─ Critical Alert ───►                 │
    │                    │                  │                   │                    ├─ Page Team ─────►
    │                    │                  │                   │                    │                 │
    │                    ├─ Recovery ───────┤                   │                    │                 │
    │◄─ Retry Option ────┤  Options        │                   │                    │                 │
```

### Error Categories:
1. **User Errors**: Validation, permissions
2. **System Errors**: Database, network
3. **External Errors**: Chess-results unavailable
4. **Critical Errors**: Data corruption, security

## Performance Optimization Flows

### Caching Strategy
```
Request ──► API Gateway ──► Cache Check ──► Cache Hit ──► Return Data
                                │
                                └─► Cache Miss ──► Database ──► Update Cache ──► Return Data
```

### Cache Layers:
1. **Browser Cache**: Static assets, API responses
2. **CDN Cache**: Images, common data
3. **Redis Cache**: Session data, frequent queries
4. **Database Cache**: Query results

### Data Compression
```
Large Dataset ──► Compress (gzip) ──► Transfer ──► Decompress ──► Process
```

## Monitoring and Analytics Flow

```
User Action ──► Frontend ──► Analytics Service ──► Process ──► Store ──► Dashboard
                   │                                              │
                   └──► Performance Metrics ──────────────────────┘
```

### Metrics Tracked:
- Page views and user flows
- Feature usage statistics
- Performance metrics
- Error rates and types
- API response times