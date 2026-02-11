# Chess Tournament Manager - API Specification

## API Overview

Base URL: `https://api.chess-manager.com/v1`

### Authentication
- JWT-based authentication
- Bearer token in Authorization header
- Public endpoints marked with 🌍

### Response Format
```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2025-08-30T10:00:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TOURNAMENT_NOT_FOUND",
    "message": "Tournament with ID 123 not found",
    "details": {}
  },
  "timestamp": "2025-08-30T10:00:00Z"
}
```

## Endpoints

### Tournament Endpoints

#### 🌍 GET /tournaments
List all tournaments with pagination and filters.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20, max: 100) |
| status | string | No | Filter by status: active, upcoming, completed |
| search | string | No | Search by tournament name |
| federation | string | No | Filter by federation (3-letter code) |
| startDate | string | No | Filter tournaments starting after (ISO 8601) |
| endDate | string | No | Filter tournaments ending before (ISO 8601) |

**Response:**
```json
{
  "success": true,
  "data": {
    "tournaments": [
      {
        "id": "uuid",
        "chessResultsId": "1233866",
        "name": "Rishon LeZion Summer Festival Blitz",
        "location": "Rishon LeZion",
        "startDate": "2025-08-30",
        "endDate": "2025-08-30",
        "roundsTotal": 9,
        "currentRound": 3,
        "status": "active",
        "timeControl": "3 min + 2 sec",
        "playersCount": 120
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

#### 🌍 GET /tournaments/:id
Get detailed tournament information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "chessResultsId": "1233866",
    "name": "Rishon LeZion Summer Festival Blitz",
    "location": "Rishon LeZion",
    "startDate": "2025-08-30",
    "endDate": "2025-08-30",
    "roundsTotal": 9,
    "currentRound": 3,
    "status": "active",
    "timeControl": "3 min + 2 sec",
    "arbiter": "IA Shachar Gindi",
    "lastScraped": "2025-08-30T10:00:00Z",
    "stats": {
      "totalPlayers": 120,
      "federations": ["ISR", "RUS", "USA"],
      "titledPlayers": 15,
      "averageRating": 2150
    }
  }
}
```

#### POST /tournaments/import
Import a tournament from chess-results.com.

**Request Body:**
```json
{
  "url": "https://s1.chess-results.com/tnr1233866.aspx",
  "autoUpdate": true,
  "updateInterval": 300
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tournamentId": "uuid",
    "status": "importing",
    "jobId": "job-uuid"
  }
}
```

#### 🌍 GET /tournaments/:id/standings
Get current tournament standings.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| round | number | No | Standings after specific round (default: current) |
| federation | string | No | Filter by federation |
| limit | number | No | Number of results (default: all) |

**Response:**
```json
{
  "success": true,
  "data": {
    "round": 3,
    "standings": [
      {
        "rank": 1,
        "player": {
          "id": "uuid",
          "name": "GM Maxim Rodshtein",
          "federation": "ISR",
          "rating": 2620,
          "title": "GM"
        },
        "points": 3.0,
        "tiebreak1": 6.5,
        "tiebreak2": 9.0,
        "performance": 2850,
        "games": [
          { "round": 1, "color": "white", "opponent": "Player Name", "result": "1" },
          { "round": 2, "color": "black", "opponent": "Player Name", "result": "0.5" },
          { "round": 3, "color": "white", "opponent": "Player Name", "result": "1" }
        ]
      }
    ]
  }
}
```

#### 🌍 GET /tournaments/:id/pairings/:round
Get pairings for a specific round.

**Response:**
```json
{
  "success": true,
  "data": {
    "tournamentId": "uuid",
    "round": 4,
    "pairings": [
      {
        "board": 1,
        "white": {
          "id": "uuid",
          "name": "GM Maxim Rodshtein",
          "rating": 2620,
          "points": 3.0
        },
        "black": {
          "id": "uuid",
          "name": "IM Daniel Gurtner",
          "rating": 2450,
          "points": 3.0
        },
        "result": null
      }
    ]
  }
}
```

### Player Endpoints

#### 🌍 GET /players
Search for players.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| search | string | Yes | Search by name (min 3 chars) |
| federation | string | No | Filter by federation |
| minRating | number | No | Minimum rating |
| maxRating | number | No | Maximum rating |
| title | string | No | Chess title (GM, IM, FM, etc.) |

**Response:**
```json
{
  "success": true,
  "data": {
    "players": [
      {
        "id": "uuid",
        "name": "Magnus Carlsen",
        "fideId": "1503014",
        "federation": "NOR",
        "rating": 2830,
        "title": "GM",
        "club": "Offerspill Chess Club"
      }
    ]
  }
}
```

#### 🌍 GET /players/:id
Get player details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Magnus Carlsen",
    "fideId": "1503014",
    "federation": "NOR",
    "rating": 2830,
    "title": "GM",
    "club": "Offerspill Chess Club",
    "recentTournaments": [
      {
        "tournamentId": "uuid",
        "name": "Tata Steel Chess Tournament 2025",
        "startDate": "2025-01-15",
        "finalRank": 1,
        "points": 9.5,
        "performance": 2895
      }
    ],
    "stats": {
      "totalGames": 150,
      "wins": 85,
      "draws": 50,
      "losses": 15,
      "winRate": 0.567
    }
  }
}
```

#### GET /players/:id/tournaments
Get player's tournament history.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20) |
| year | number | No | Filter by year |

### User Endpoints

#### POST /auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "chessplayer123",
  "password": "securepassword"
}
```

#### POST /auth/login
Login user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "chessplayer123"
    }
  }
}
```

#### GET /users/me
Get current user profile.

#### PUT /users/me
Update user profile.

**Request Body:**
```json
{
  "username": "newusername",
  "preferences": {
    "notifications": true,
    "theme": "dark",
    "language": "en"
  }
}
```

### Following Endpoints

#### GET /users/me/following
Get followed players and tournaments.

**Response:**
```json
{
  "success": true,
  "data": {
    "players": [
      {
        "playerId": "uuid",
        "player": {
          "name": "Magnus Carlsen",
          "rating": 2830
        },
        "followedAt": "2025-08-01T10:00:00Z"
      }
    ],
    "tournaments": [
      {
        "tournamentId": "uuid",
        "tournament": {
          "name": "Tata Steel 2025",
          "status": "active"
        },
        "followedAt": "2025-08-15T10:00:00Z"
      }
    ]
  }
}
```

#### POST /users/me/following/players
Follow a player.

**Request Body:**
```json
{
  "playerId": "uuid"
}
```

#### DELETE /users/me/following/players/:playerId
Unfollow a player.

#### POST /users/me/following/tournaments
Follow a tournament.

#### DELETE /users/me/following/tournaments/:tournamentId
Unfollow a tournament.

### Notification Endpoints

#### GET /users/me/notifications
Get user notifications.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| unread | boolean | No | Filter unread only |
| type | string | No | Filter by type |
| page | number | No | Page number |
| limit | number | No | Items per page |

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "player_game_started",
        "title": "Magnus Carlsen's game started",
        "message": "Round 5 game against Hikaru Nakamura has started",
        "data": {
          "playerId": "uuid",
          "tournamentId": "uuid",
          "round": 5,
          "board": 1
        },
        "read": false,
        "createdAt": "2025-08-30T14:00:00Z"
      }
    ],
    "unreadCount": 5
  }
}
```

#### PUT /users/me/notifications/:id/read
Mark notification as read.

#### POST /users/me/notifications/subscribe
Subscribe to push notifications.

**Request Body:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

### Real-time Endpoints

#### GET /events/stream
Server-Sent Events endpoint for real-time updates.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| tournaments | string | No | Comma-separated tournament IDs |
| players | string | No | Comma-separated player IDs |

**Event Types:**
- `tournament-update`: Tournament status change
- `round-started`: New round started
- `game-result`: Game result updated
- `standings-update`: Standings changed
- `pairing-posted`: New pairings available

**Event Format:**
```
event: game-result
data: {"tournamentId":"uuid","round":5,"board":1,"result":"1-0"}
```

### Export Endpoints

#### 🌍 GET /tournaments/:id/export/pgn
Export tournament games in PGN format.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| round | number | No | Specific round only |
| player | string | No | Games of specific player |

#### 🌍 GET /tournaments/:id/export/csv
Export tournament data in CSV format.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | Yes | standings, pairings, players |
| round | number | No | Specific round (for standings/pairings) |

### Admin Endpoints

#### GET /admin/scraping/jobs
Get scraping job status.

#### POST /admin/scraping/trigger
Manually trigger tournament update.

**Request Body:**
```json
{
  "tournamentId": "uuid",
  "force": true
}
```

#### GET /admin/stats
Get system statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "tournaments": {
      "total": 1500,
      "active": 45,
      "upcoming": 20,
      "completed": 1435
    },
    "players": {
      "total": 25000,
      "titled": 1200
    },
    "users": {
      "total": 5000,
      "active": 1200
    },
    "scraping": {
      "jobsInQueue": 12,
      "lastSuccess": "2025-08-30T14:55:00Z",
      "successRate": 0.98
    }
  }
}
```

## Rate Limiting

| Endpoint Type | Rate Limit | Window |
|--------------|------------|---------|
| Public endpoints | 100 requests | 15 minutes |
| Authenticated endpoints | 1000 requests | 15 minutes |
| Scraping endpoints | 10 requests | 1 hour |
| Export endpoints | 50 requests | 1 hour |

## WebSocket Events

### Connection
```javascript
const ws = new WebSocket('wss://api.chess-manager.com/v1/ws');
ws.send(JSON.stringify({
  type: 'auth',
  token: 'jwt-token'
}));
```

### Subscribe to Updates
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  tournaments: ['uuid1', 'uuid2'],
  players: ['uuid3', 'uuid4']
}));
```

### Event Types
- `tournament:update` - Tournament metadata changed
- `tournament:round:start` - New round started
- `tournament:round:complete` - Round completed
- `game:start` - Game started
- `game:result` - Game finished
- `standings:update` - Standings updated
- `player:update` - Player data changed

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request data |
| RATE_LIMITED | 429 | Too many requests |
| SCRAPING_ERROR | 500 | Failed to scrape data |
| DATABASE_ERROR | 500 | Database operation failed |
| EXTERNAL_SERVICE_ERROR | 502 | Chess-results.com unavailable |