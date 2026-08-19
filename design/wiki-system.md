# Wiki System

## Overview

The Wiki System provides in-game documentation and strategy guides. Page content is authored directly as TypeScript objects in `src/lib/seeds/wiki/pages/*.ts` and seeded into the `wikiPages` collection, it is **not** synced live from `docs/design/` markdown files at runtime. (This repo's public `docs/design/` and `docs/wiki/` trees exist for developer/community reference, but there is no game code that reads them into `wikiPages`.)

**Location:** `src/lib/wiki/` (runtime read/search/render), `src/lib/seeds/wiki/` (page content + seeding)

**Key files:**

- `getWikiPageData.ts` - Fetch wiki page metadata for display
- `loadContent.ts` - Load markdown content and transform wikilinks
- `searchIndex.ts` - Build unified search index (pages, politicians, seats, parties, leadership)
- `syncPriorSubmissions.ts` - Renames legacy ObjectId-embedded slugs (`player-{hex}`, `corp-{hex}`, `party-profile-{hex}`) to sequentialId-based slugs; see [Slug Migration](#slug-migration) below
- `seatData.ts` - Derive seat slugs and titles from states collection
- `partyData.ts` - Fetch party data for wiki pages
- `leadershipData.ts` - Fetch congressional leadership data
- `playerPages.ts` - Player character profile data for wiki
- `redirects.ts` - Legacy slug → canonical path mappings
- `componentRegistry.ts` - Custom markdown component registry
- `categories.ts` - Wiki page categories
- `learningPaths.ts` - Curated learning path definitions

## Wiki Page Configuration

Pages are configured in `WIKI_SEED_PAGES` array (`src/lib/seeds/wiki/pages.ts`), aggregated from category files in `src/lib/seeds/wiki/pages/*.ts`:

```typescript
export const WIKI_SEED_PAGES: readonly WikiSeedPage[] = [
  ...gettingStartedPages,
  ...electionsPages,
  ...legislaturesPages,
  ...partiesPages,
  ...countriesPages,
  ...economyPages,
  ...advancedPages,
  ...resourcesPages,
  ...commoditiesPages,
];
```

Each `WikiSeedPage` (`src/lib/seeds/wiki/types.ts`) defines:

- `slug`, URL identifier
- `title`, `description`, `content`, Display data
- `category`, Primary category (also used as first tag)
- `featured`, Highlighted on wiki home
- `difficulty`, `contentType`, `estimatedReadTime`, Metadata
- `countryId`, Optional country scoping
- `private`, Admin-only page

### Categories

Pages are organized into categories:

| Category          | Purpose                        |
| ----------------- | ------------------------------ |
| `getting-started` | New player guides              |
| `elections`       | Election mechanics and history |
| `congress`        | Legislative system             |
| `parties`         | Party mechanics                |
| `npps`            | NPP system guides              |
| `states`          | State-level mechanics          |
| `strategy`        | Advanced strategy guides       |
| `reference`       | Technical reference docs       |

### Featured Pages

Pages with `featured: true` are highlighted on the wiki home page:

- `getting-started` - Core systems overview
- `core-systems` - Turn structure, actions
- `elections` - Election browser

### Special Routes

Some slugs use custom UI instead of markdown rendering. These special live routes are handled by dedicated page components and cannot be overridden by markdown files:

- `/wiki/elections`, Election browser
- `/wiki/roadmap`, Game roadmap
- `/wiki/paths/*`, Learning paths
- `/wiki/party/[id]`, Party profile pages
- `/wiki/seat/[slug]`, Seat/office pages
- `/wiki/leadership/[role]`, Congressional leadership roles

## Content Seeding

Wiki content lives as TypeScript `WikiSeedPage` objects (not markdown files) under `src/lib/seeds/wiki/pages/*.ts`, aggregated in `WIKI_SEED_PAGES` (`src/lib/seeds/wiki/pages.ts`) and written to `wikiPages` by the seeder (`src/lib/seeds/wiki/seeder.ts`, `index.ts`). Editing a page means editing its `WikiSeedPage` entry and re-seeding, there is no admin-panel "sync from docs/design" action.

## Slug Migration

### `syncPriorWikiSubmissions(db, moderatorId)`

**Purpose:** Rename legacy ObjectId-embedded wiki slugs to their current sequentialId-based form (`src/lib/wiki/syncPriorSubmissions.ts`).

**Logic:**

1. Find every `wikiPages` document whose slug matches `player-{hex}`, `corp-{hex}`, or `party-profile-{hex}` (24-hex ObjectId).
2. Resolve the embedded ObjectId to the live character/corporation/party and look up its `sequentialId`.
3. Skip (recording a reason) if the entity no longer exists, has no `sequentialId`, or the new slug is already taken.
4. Otherwise rename the page's slug to the current `playerWikiSlug()` / `corporationWikiSlug()` / `partyWikiSlug()` form.

**Returns:**

```typescript
interface SyncPriorSubmissionsResult {
  renamed: SyncPriorRenamed[]; // { oldSlug, newSlug, kind }
  skipped: SyncPriorSkipped[]; // { oldSlug, reason }
}
```

This is a one-way cleanup pass for stale slugs, not a content-sync mechanism.

## Wiki Page Schema

```typescript
interface WikiPage {
  _id: ObjectId;
  slug: string; // Unique identifier
  title: string;
  description: string;
  content: string; // Markdown content
  status: "draft" | "pending_review" | "published" | "archived";
  submittedBy: ObjectId; // User who created/edited
  tags: string[];
  featured: boolean;
  isAutoGenerated: boolean;
  editHistory: EditHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

interface EditHistoryEntry {
  userId: ObjectId;
  timestamp: Date;
  action: "created" | "edited" | "approved" | "rejected" | "archived";
  note?: string;
}
```

## Auto-Update Triggers

The wiki can auto-update on game events:

### Election Results

When elections resolve, wiki pages can be updated with new results.

### Leadership Changes

When party leadership or government leadership changes, relevant pages update.

## Learning Paths

Wiki pages can be organized into learning paths for new players:

1. **Getting Started Path:**
   - `getting-started` → `core-systems` → `player-progression` → `stats-actions`

2. **Elections Path:**
   - `election-mechanics` → `campaign-strategy` → `demographics-targeting` → `fundraising-ads`

3. **Strategy Path:**
   - `state-level-power` → `party-building` → `meta-strategy` → `min-maxing`

## Integration Points

### API Routes

Wiki pages are served via API:

```typescript
GET / api / wiki / { slug };
```

### Server Components

Wiki data is fetched in server components:

```typescript
const pageData = await getWikiPageData(slug);
```

### Admin Panel

Admins can trigger the legacy-slug rename pass (`syncPriorWikiSubmissions`) and manage page publish status from the admin panel.

## Content Authoring

Wiki page content is authored as `WikiSeedPage` TypeScript objects, organized by category file under `src/lib/seeds/wiki/pages/` (`gettingStartedPages`, `electionsPages`, `legislaturesPages`, `partiesPages`, `countriesPages`, `economyPages`, `advancedPages`, `resourcesPages`, `commoditiesPages`). `docs/design/` and `docs/wiki/` are separate developer-facing reference trees; changes there do not propagate to the in-game wiki automatically.

## Content Guidelines

### Featured Pages

Featured pages should:

- Be high-quality and well-maintained
- Cover core mechanics
- Be accessible to new players

### Categories

Choose the most specific category:

- Use `getting-started` for new player essentials
- Use `reference` for data tables and formulas
- Use `strategy` for advanced tactics

### Tags

Tags enable cross-category discovery:

- `elections`, `campaigns`, `npps`, `parties`
- `economy`, `budget`, `bonds`
- `congress`, `legislation`, `bills`

## Related Systems

- **Design Docs:** `docs/design/` - Source markdown files
- **Wiki API:** `src/app/api/wiki/` - Wiki route handlers
- **Admin Tools:** `src/app/admin/` - Sync triggers
