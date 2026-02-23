# F1 Intelligence - Product Requirements Document

## Original Problem Statement
F1 Intelligence is a premium-feeling, dark-themed web app that lets users explore Formula 1 history through five MVP modules:
1. Analytics Studio (slice/dice + comparisons)
2. Race Deep Dive (lap-by-lap story + strategy + movers)
3. Story & Stats Explorer (interactive encyclopedia + shareable facts)
4. Rivalry Explorer (head-to-head comparisons)
5. GOAT Engine (configurable weighted rankings)

## User Personas
- **F1 Enthusiasts**: Fans who want to explore historical data and statistics
- **Fantasy F1 Players**: Users seeking data-driven insights for fantasy picks
- **F1 Historians**: Researchers comparing drivers across eras
- **Casual Viewers**: Users looking for quick facts and shareable stats

## Core Requirements (Static)
- Premium dark theme (#0B0D10 base)
- Interactive charts and visualizations
- Deep-link state management (URL encoding)
- Mobile responsive design
- Export/share functionality
- Support for 700K+ records efficiently

## What's Been Implemented (Feb 23, 2026)
### Backend
- ✅ MongoDB with 14 CSV datasets imported (circuits, constructors, drivers, races, results, qualifying, lap_times, pit_stops, driver_standings, constructor_standings, constructor_results, status, seasons, sprint_results)
- ✅ RESTful API with FastAPI
- ✅ Endpoints: /api/stats/overview, /api/stats/drivers, /api/stats/constructors
- ✅ Race Deep Dive: /api/race/{id}, /api/race/{id}/results, /api/race/{id}/lap-times, /api/race/{id}/pit-stops, /api/race/{id}/movers
- ✅ Rivalry: /api/rivalry/{d1}/{d2} with circuit_breakdown
- ✅ GOAT: /api/goat/leaderboard with configurable weights
- ✅ Story Explorer: /api/driver/{id}/profile, /api/circuit/{id}/profile, /api/constructor/{id}/profile, /api/season/{year}/profile, /api/facts/generate

### Frontend
- ✅ Premium dark theme with Barlow Condensed + JetBrains Mono fonts
- ✅ Analytics Studio with KPI tiles and bar charts
- ✅ Race Deep Dive with position-by-lap chart and pit stop timeline
- ✅ Story Explorer with driver/constructor/circuit/season profiles and fact generator
- ✅ Rivalry Explorer with head-to-head statistics, comparison bars, and circuit-by-circuit breakdown
- ✅ GOAT Engine with weight sliders and live leaderboard
- ✅ Global navigation between all 5 modules
- ✅ Filter bar with season/driver/constructor selection
- ✅ Deep-link URL state management

## Prioritized Backlog
### P0 (Critical)
- All implemented ✅

### P1 (High Priority)
- ✅ Constructor profile in Story Explorer (DONE)
- ✅ Season profile/summary view (DONE)
- ✅ Circuit-by-circuit breakdown in Rivalry Explorer (DONE)
- [ ] Mobile-optimized filter drawer

### P2 (Medium Priority)
- [ ] Export chart as image
- [ ] Share fact cards with social preview
- [ ] "Key races" list in Rivalry Explorer
- [ ] Fastest lap analysis in Race Deep Dive

### P3 (Nice to Have)
- [ ] User authentication for saved preferences
- [ ] Favorite drivers/circuits
- [ ] Custom GOAT preset saving
- [ ] Era-adjusted statistics

## Bug Fixes Completed (Feb 23, 2026)
### User-Reported Issues - ALL FIXED ✅
1. ✅ **Filter search bars** - Added SearchableSelect component with Command for searching 860+ drivers and 210+ constructors
2. ✅ **Chart reflects filters** - Charts and KPIs update when GO button is clicked (filters applied via URL params)
3. ✅ **GO button for filters** - Added "GO" button to batch filter selections before processing
4. ✅ **Generate Facts for all tabs** - Extended backend to support constructor and circuit fact generation
5. ✅ **Seasons tab runtime error** - Fixed null safety in getEntityId/getEntityName functions
6. ✅ **Rivalry search UX** - Replaced inline search with Popover-based searchable dropdown (no interference)

## Next Tasks
1. Add social share preview for fact cards
2. Mobile-optimized filter drawer
3. Export chart as image functionality
4. Consider Emergent Google Auth for user accounts

## Session Log - Feb 23, 2026
- Verified application is fully functional after handoff (no crash - previous issue resolved)
- Tested Analytics Studio, Story Explorer, and Rivalry Explorer - all working
- Confirmed circuit-by-circuit breakdown returns 32 circuits for Hamilton vs Verstappen comparison
- Fixed all 6 user-reported bugs/improvements
- Testing agent verified 100% pass rate (17/17 backend tests, 9/9 frontend tests)
