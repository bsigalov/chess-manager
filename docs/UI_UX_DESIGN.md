# Chess Tournament Manager - UI/UX Design Guidelines

## Design Philosophy

### Core Principles
1. **Chess-First**: Design should respect chess culture and conventions
2. **Information Density**: Display comprehensive data without clutter
3. **Real-time Focus**: Emphasize live updates and current status
4. **Mobile Responsive**: Full functionality on all devices
5. **Accessibility**: WCAG 2.1 AA compliance

## Visual Design

### Color Palette

#### Light Theme
```css
/* Primary Colors */
--primary-50: #f0f9ff;    /* Lightest blue */
--primary-100: #e0f2fe;
--primary-200: #bae6fd;
--primary-500: #3b82f6;   /* Main brand blue */
--primary-600: #2563eb;
--primary-700: #1d4ed8;
--primary-900: #1e3a8a;   /* Darkest blue */

/* Chess Board Colors */
--board-light: #f0d9b5;   /* Light squares */
--board-dark: #b58863;    /* Dark squares */

/* Semantic Colors */
--success: #10b981;       /* Win/Positive */
--warning: #f59e0b;       /* Draw/Caution */
--error: #ef4444;         /* Loss/Error */

/* Neutral Colors */
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-500: #6b7280;
--gray-900: #111827;
```

#### Dark Theme
```css
/* Inverted scale with adjusted chess colors */
--board-light: #d4b5a0;   /* Slightly muted for dark mode */
--board-dark: #9b6f47;
--bg-primary: #0f172a;    /* Main background */
--bg-secondary: #1e293b;  /* Card background */
```

### Typography

#### Font Stack
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace; /* For moves/notation */
```

#### Type Scale
```css
--text-xs: 0.75rem;      /* 12px - Metadata */
--text-sm: 0.875rem;     /* 14px - Secondary text */
--text-base: 1rem;       /* 16px - Body text */
--text-lg: 1.125rem;     /* 18px - Subheadings */
--text-xl: 1.25rem;      /* 20px - Section titles */
--text-2xl: 1.5rem;      /* 24px - Page titles */
--text-3xl: 1.875rem;    /* 30px - Hero text */
```

### Spacing System
```css
--space-1: 0.25rem;      /* 4px */
--space-2: 0.5rem;       /* 8px */
--space-3: 0.75rem;      /* 12px */
--space-4: 1rem;         /* 16px */
--space-6: 1.5rem;       /* 24px */
--space-8: 2rem;         /* 32px */
--space-12: 3rem;        /* 48px */
```

## Component Specifications

### Navigation

#### Desktop Navigation
```
┌─────────────────────────────────────────────────────────────┐
│ 🏆 ChessManager  | Tournaments | Players | Following | 🔔 👤 │
└─────────────────────────────────────────────────────────────┘
```

- Fixed header with blur backdrop
- Search bar expands on focus
- Notification bell with unread count badge
- User avatar with dropdown menu

#### Mobile Navigation
```
┌─────────────────────────────────────────────────────────────┐
│ ☰  ChessManager                                    🔍 🔔 👤  │
└─────────────────────────────────────────────────────────────┘
```

- Hamburger menu for main navigation
- Bottom tab bar for key actions
- Swipe gestures for navigation

### Tournament List View

#### Desktop Layout (Grid)
```
┌─────────────────────────────────────────────────────────────┐
│ Active Tournaments                             [Grid] [List] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│ │ Tournament Card  │ │ Tournament Card  │ │ Tournament Card  ││
│ │                  │ │                  │ │                  ││
│ │ 📍 Location      │ │ 📍 Location      │ │ 📍 Location      ││
│ │ 👥 120 players   │ │ 👥 85 players    │ │ 👥 64 players    ││
│ │ 🎯 Round 5/9     │ │ 🎯 Round 7/11    │ │ 🎯 Completed     ││
│ │                  │ │                  │ │                  ││
│ │ [View] [Follow]  │ │ [View] [Follow]  │ │ [View Results]   ││
│ └─────────────────┘ └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### Mobile Layout (Stack)
```
┌─────────────────────────────────┐
│ Active Tournaments              │
├─────────────────────────────────┤
│ ┌───────────────────────────────┤
│ │ Tata Steel Chess 2025         ││
│ │ Wijk aan Zee • Round 5/13     ││
│ │ 👥 14 players • ⚡ Classical   ││
│ └───────────────────────────────┤
│ ┌───────────────────────────────┤
│ │ Gibraltar Chess Festival      ││
│ │ Gibraltar • Round 7/10         ││
│ │ 👥 256 players • ⚡ Classical  ││
│ └───────────────────────────────┤
└─────────────────────────────────┘
```

### Tournament Detail View

#### Tab Navigation
```
┌─────────────────────────────────────────────────────────────┐
│ Tata Steel Chess Tournament 2025                            │
│ Wijk aan Zee, Netherlands • January 15-28                  │
├─────────────────────────────────────────────────────────────┤
│ Overview | Standings | Pairings | Players | Schedule | Stats│
├─────────────────────────────────────────────────────────────┤
│ [Tab Content]                                               │
└─────────────────────────────────────────────────────────────┘
```

#### Standings Table
```
┌─────────────────────────────────────────────────────────────┐
│ # │ Player              │ Fed │ Rtg  │ Pts │ TB1 │ TB2 │ Perf│
├───┼────────────────────┼─────┼──────┼─────┼─────┼─────┼─────┤
│ 1 │ GM Magnus Carlsen   │ NOR │ 2830 │ 6.5 │ 28.5│ 35.0│ 2925│
│ 2 │ GM Fabiano Caruana  │ USA │ 2805 │ 6.0 │ 27.0│ 33.5│ 2885│
│ 3 │ GM Ding Liren      │ CHN │ 2780 │ 5.5 │ 26.5│ 32.0│ 2845│
└─────────────────────────────────────────────────────────────┘
```

- Sortable columns
- Highlighted followed players
- Expandable row for game history
- Live position updates with animation

#### Pairings View
```
┌─────────────────────────────────────────────────────────────┐
│ Round 5 - January 20, 2025 14:00                    [Live] │
├─────────────────────────────────────────────────────────────┤
│ Board 1                                                     │
│ ┌───────────────────────┐ vs ┌───────────────────────────┐│
│ │ GM Magnus Carlsen     │    │ GM Fabiano Caruana      ││
│ │ 2830 • 4.0 pts       │    │ 2805 • 3.5 pts          ││
│ └───────────────────────┘    └───────────────────────────┘│
│                    [Follow Game]                            │
├─────────────────────────────────────────────────────────────┤
│ Board 2                                                     │
│ ┌───────────────────────┐ vs ┌───────────────────────────┐│
│ │ GM Ding Liren        │    │ GM Ian Nepomniachtchi   ││
│ │ 2780 • 3.5 pts       │    │ 2795 • 3.5 pts          ││
│ └───────────────────────┘    └───────────────────────────┘│
│                    [Follow Game]                            │
└─────────────────────────────────────────────────────────────┘
```

### Player Profile

```
┌─────────────────────────────────────────────────────────────┐
│ GM Magnus Carlsen                              [Follow]     │
│ 🇳🇴 Norway • FIDE: 1503014 • Rating: 2830              │
├─────────────────────────────────────────────────────────────┤
│ Current Tournament                                          │
│ ┌─────────────────────────────────────────────────────────┤
│ │ Tata Steel 2025 • Position: 1st • Performance: 2925     ││
│ │ ● ● ● ○ ● ½ ● - - - -  (6.5/7)                         ││
│ └─────────────────────────────────────────────────────────┤
├─────────────────────────────────────────────────────────────┤
│ Statistics                                                  │
│ Total Games: 89 | Win: 45 (50.6%) | Draw: 38 | Loss: 6    │
│ Best Performance: 2985 (Norway Chess 2024)                 │
│ Tournaments Played: 12                                      │
└─────────────────────────────────────────────────────────────┘
```

### Interactive Elements

#### Buttons
```css
/* Primary Button */
.btn-primary {
  background: var(--primary-500);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: var(--primary-600);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: var(--primary-500);
  border: 1px solid var(--primary-500);
}
```

#### Cards
```css
.card {
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  transition: all 0.2s;
}

.card:hover {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  transform: translateY(-2px);
}
```

### Loading States

#### Skeleton Screens
```
┌─────────────────────────────────────────────────────────────┐
│ ████████████████████                                        │
│ ████████████ ██████████ ████████                           │
│                                                             │
│ ███ ████████████████ ████ █████ ████ ████ ████ ████       │
│ ███ ████████████████ ████ █████ ████ ████ ████ ████       │
│ ███ ████████████████ ████ █████ ████ ████ ████ ████       │
└─────────────────────────────────────────────────────────────┘
```

#### Progress Indicators
- Circular spinner for actions
- Linear progress bar for imports
- Pulsing dot for live updates

### Notification Patterns

#### Toast Notifications
```
┌─────────────────────────────────────┐
│ ✅ Tournament followed successfully │
│                              [X]    │
└─────────────────────────────────────┘
```

Position: Top-right (desktop), Top-center (mobile)
Duration: 3 seconds for success, 5 seconds for errors

#### In-App Notifications
```
┌─────────────────────────────────────────────────────────────┐
│ 🔔 Magnus Carlsen just won against Fabiano Caruana         │
│    Tata Steel 2025 • Round 5 • 2 minutes ago              │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

```css
/* Mobile First Approach */
--screen-sm: 640px;   /* Small tablets */
--screen-md: 768px;   /* Tablets */
--screen-lg: 1024px;  /* Desktop */
--screen-xl: 1280px;  /* Large desktop */
--screen-2xl: 1536px; /* Extra large */
```

### Animation Guidelines

#### Transitions
```css
/* Standard timing */
--transition-fast: 150ms ease-in-out;
--transition-base: 200ms ease-in-out;
--transition-slow: 300ms ease-in-out;

/* Live updates should feel instant */
.live-update {
  transition: background-color 100ms ease-in-out;
}
```

#### Micro-interactions
1. **Hover states**: Subtle elevation and color change
2. **Click feedback**: Scale down 0.98 on press
3. **Live updates**: Flash background color
4. **Loading**: Smooth skeleton animations
5. **Page transitions**: Fade in/out

### Accessibility Requirements

#### Color Contrast
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: 3:1 minimum

#### Keyboard Navigation
- All interactive elements keyboard accessible
- Visible focus indicators
- Skip to content link
- Logical tab order

#### Screen Reader Support
- Semantic HTML structure
- ARIA labels for icons
- Live regions for updates
- Alternative text for images

### Mobile-Specific Considerations

#### Touch Targets
- Minimum 44x44px touch targets
- 8px spacing between targets
- Larger targets for primary actions

#### Gestures
- Swipe to navigate between rounds
- Pull to refresh for updates
- Long press for context menus
- Pinch to zoom on diagrams

#### Performance
- Lazy load images
- Virtualize long lists
- Progressive enhancement
- Offline-first approach

## Design Patterns

### Empty States
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     🏆                                      │
│              No tournaments found                           │
│                                                             │
│         Try adjusting your filters or                      │
│         import a tournament from chess-results.com          │
│                                                             │
│              [Import Tournament]                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Error States
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     ⚠️                                       │
│           Unable to load tournament data                    │
│                                                             │
│      Please check your connection and try again            │
│                                                             │
│                  [Retry]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Success Feedback
- Green checkmark animation
- Subtle success message
- Auto-dismiss after 3 seconds

## Icon System

### Chess-Specific Icons
- ♔ ♕ ♖ ♗ ♘ ♙ - Piece symbols
- 🏆 - Tournament
- 👥 - Players count
- 🎯 - Current round
- ⚡ - Blitz/Rapid indicator
- 📍 - Location
- 🔄 - Live/updating
- 📊 - Statistics

### Action Icons
- ➕ Add/Follow
- ✏️ Edit
- 🗑️ Delete
- 🔍 Search
- ⚙️ Settings
- 📤 Export
- 🔔 Notifications
- 👤 Profile

## Development Guidelines

### Component Structure
```tsx
// Example component structure
<Card>
  <CardHeader>
    <CardTitle>Tournament Name</CardTitle>
    <CardDescription>Location • Date</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    <Button>View Details</Button>
  </CardFooter>
</Card>
```

### CSS Architecture
- Use CSS Modules or styled-components
- Follow BEM naming convention
- Mobile-first approach
- Use CSS custom properties

### Performance Metrics
- First Contentful Paint: < 1.8s
- Time to Interactive: < 3.9s
- Cumulative Layout Shift: < 0.1
- Largest Contentful Paint: < 2.5s