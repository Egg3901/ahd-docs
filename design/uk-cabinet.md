# UK Cabinet System

## Overview

The UK Cabinet System manages cabinet appointments for the United Kingdom government. The Prime Minister appoints and dismisses cabinet ministers from among MPs of the governing party or coalition.

**Location:** `src/lib/uk/`

**Key files:**

- `cabinetApi.ts` - API route handlers for appointments
- `cabinetEligibility.ts` - Eligibility rules and queries
- `constants.ts` - Cabinet position definitions

## Cabinet Positions

Cabinet positions are defined in `UK_CABINET_POSITIONS` (`src/lib/constants/ukCabinet.ts`), 18 entries in file order (agriculture_secretary and environment_secretary share `order: 12` because their eras are disjoint: agriculture retires in 2001 and hands off to environment via `succeededBy`):

| Order | Position ID                | Name (base)                                             | Year Enabled |
| ----- | --------------------------- | -------------------------------------------------------- | ------------ |
| 0     | `deputy_prime_minister`     | Deputy Prime Minister                                     | 1775         |
| 1     | `first_secretary_of_state`  | First Secretary of State                                   | 1962         |
| 2     | `chancellor`                | Chancellor of the Exchequer                                | 1775         |
| 3     | `foreign_secretary`         | Foreign Secretary                                          | 1775         |
| 4     | `home_secretary`            | Home Secretary                                             | 1775         |
| 5     | `defence_secretary`         | Secretary of State for Defence                              | 1775         |
| 6     | `justice_secretary`         | Lord Chancellor & Secretary of State for Justice            | 1775         |
| 7     | `health_secretary`          | Secretary of State for Health and Social Care               | 1775         |
| 8     | `education_secretary`       | Secretary of State for Education                            | 1775         |
| 9     | `business_secretary`        | Secretary of State for Business, Energy and Industrial Strategy | 1775     |
| 10    | `levelling_secretary`       | Secretary of State for Housing, Communities and Local Government | 1775   |
| 11    | `transport_secretary`       | Secretary of State for Transport                            | 1775         |
| 12    | `agriculture_secretary`     | Minister of Agriculture, Fisheries and Food (retires 2001, succeeded by `environment_secretary`) | 1775 |
| 12    | `environment_secretary`     | Secretary of State for Environment, Food and Rural Affairs  | 2001         |
| 13    | `work_secretary`            | Secretary of State for Work and Pensions                    | 1775         |
| 14    | `northern_ireland`          | Secretary of State for Northern Ireland                     | 1972         |
| 15    | `scotland`                  | Secretary of State for Scotland                             | 1775         |
| 16    | `wales`                     | Secretary of State for Wales                                | 1964         |

Each seat's display name can also change over time within its era (`namesByYear`, resolved against the live game year, e.g. `defence_secretary` reads "Secretary of State for War" before 1964). The base names above are the seat's identity, not necessarily the label shown at every year.

## Eligibility Rules

### Prime Minister Authorization

Only the current Prime Minister can appoint or dismiss cabinet ministers. This check is enforced by `requireCurrentPrimeMinister` (`src/lib/api/headOfGovernment.ts`), which is **not UK-specific**. It is a shared, country-agnostic guard used by every parliamentary country that has a PM office (UK, JP, DE), keyed on `countryId`. There is no separate UK-only PM guard.

### Minister Eligibility

To be eligible for cabinet appointment:

1. **Must hold seat in House of Commons**, Lords cannot serve in cabinet
2. **Must be from governing party or coalition**, Coalition members get cabinet slots
3. **Cannot already hold cabinet position**, One position per character
4. **Cannot be the PM themselves**, PM cannot appoint themselves to additional positions

```typescript
export async function getEligibleUKCabinetCharacters(
  db: Db,
  gov: UKGovernment
): Promise<Character[]> {
  // Get allowed party IDs from coalition
  const allowedPartyIds = new Set(await getUKCabinetAllowedPartyIds(db, gov));

  // Find all Commons members from allowed parties
  const commonsMembers = await db
    .collection<ElectedOfficial>("electedOfficials")
    .find({
      officeType: "commons",
      countryId: "UK",
      party: { $in: [...allowedPartyIds] },
    })
    .toArray();

  // Filter out PM and current cabinet members
  const cabinetMemberIds = await getCabinetMembersCollection(db)
    .find({ countryId: "UK" }, { projection: { characterId: 1 } })
    .toArray();

  return characters.filter(
    (c) =>
      !c._id.equals(gov.pmCharacterId) &&
      !cabinetMemberIds.some((cm) => cm.characterId.equals(c._id))
  );
}
```

### Coalition Cabinet Allocation

In coalition governments, cabinet positions are allocated proportionally:

```typescript
export async function getUKCabinetAllowedPartyIds(db: Db, gov: UKGovernment): Promise<string[]> {
  if (!gov.coalitionId) {
    return [gov.pmParty]; // Single-party government
  }

  const coalition = await db.collection<Coalition>("coalitions").findOne({ _id: gov.coalitionId });
  if (!coalition) return [gov.pmParty];

  // Return all coalition member party IDs
  return coalition.memberParties.map((p) => p.partyId);
}
```

## Appointment Flow

### 1. View Eligible Characters

```typescript
GET /api/uk/cabinet/eligible

Response:
{
  success: true,
  characters: Character[]  // Eligible for appointment
}
```

### 2. Appoint Minister

```typescript
POST /api/uk/cabinet/appoint
Body: { positionId: string, characterId: string }

Authorization: requireAuth() + requireCurrentPrimeMinister(db, countryId, userId)

Checks:
1. Position exists in UK_CABINET_POSITIONS
2. Character exists and is player character
3. Character holds Commons seat
4. Character is from governing party/coalition
5. Character is not PM
6. Position is not already filled
7. Position is not on cooldown
8. Character doesn't already hold cabinet position

Effects:
1. Insert record into `cabinetMembers` (shared collection, `countryId: "UK"`)
2. Add career history entry to character
3. Reset advocacy toggle for territorial secretaries (NI, Scotland, Wales)
```

### 3. Dismiss Minister

```typescript
POST /api/uk/cabinet/fire
Body: { positionId: string }

Authorization: requireAuth() + requireCurrentPrimeMinister(db, countryId, userId)

Checks:
1. Position exists
2. Position is currently filled

Effects:
1. Delete record from `cabinetMembers` (shared collection)
2. Insert record into `ukCabinetCooldowns` (24-turn cooldown)
```

## Cooldown System

When a minister is dismissed, the position enters a 24-turn cooldown (`COOLDOWN_TURNS` in `cabinetApi.ts`; appointment itself is unrestricted and imposes no cooldown):

```typescript
const COOLDOWN_TURNS = 24;
// Locked for COOLDOWN_TURNS turns from this appointment/firing, keyed to turn
// length so it tracks game time regardless of wall-clock drift.
const cooldownUntilTurn = appointTurn + COOLDOWN_TURNS;
const cooldownUntil = new Date(now.getTime() + COOLDOWN_TURNS * turnLengthMinutes * 60_000);

await getUKCabinetCooldownsCollection(db).updateOne(
  { countryId: "UK", positionId },
  {
    $set: {
      countryId: "UK",
      positionId,
      firedCharacterId: member.characterId,
      firedByPmCharacterId: pmCharacter._id,
      firedAt: now,
      cooldownUntil,
    },
  },
  { upsert: true }
);
```

**Purpose:** Prevents rapid hire/fire cycles and gives dismissed ministers time to respond.

## Advocacy Toggle

Territorial secretaries (Northern Ireland, Scotland, Wales) have an advocacy toggle that can be activated to advocate for their region. This toggle is **automatically reset** when a new minister is appointed:

```typescript
if (["northern_ireland", "scotland", "wales"].includes(positionId)) {
  await getCabinetSettingsCollection(db).updateOne(
    { _id: `UK_${positionId}` },
    { $set: { advocacyActive: false, updatedAt: new Date() } }
  );
}
```

## Data Model

### Collections

| Collection           | Purpose                                 |
| -------------------- | --------------------------------------- |
| `cabinetMembers`     | Current cabinet ministers (shared across all countries, keyed by `countryId`) |
| `ukCabinetCooldowns` | Dismissal cooldowns                     |
| `cabinetSettings`    | Per-position settings (advocacy toggle) |
| `characters`         | Career history updates                  |
| `electedOfficials`   | Commons seat verification               |

### Document Types

```typescript
// Shared cabinetMembers doc shape, filtered by countryId: "UK" for this system.
interface CabinetMember {
  _id: ObjectId;
  countryId: string;
  positionId: string;
  characterId: ObjectId;
  characterName: string;
  party: string;
  appointedByPmCharacterId: ObjectId;
  appointedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface UKCabinetCooldown {
  _id: ObjectId;
  countryId: "UK";
  positionId: string;
  firedCharacterId: ObjectId;
  firedByPmCharacterId: ObjectId;
  firedAt: Date;
  cooldownUntil: Date;
  cooldownUntilTurn: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CabinetSettings {
  _id: string; // "UK_{positionId}"
  advocacyActive: boolean;
  updatedAt: Date;
}
```

## Career History

Cabinet appointments add entries to character career history:

```typescript
const cabinetOffice: OfficeType = { type: "ukCabinet", positionId };
const careerEvent: CareerEvent = {
  type: "appointed",
  office: cabinetOffice,
  officeLabel: getOfficeLabel(cabinetOffice, "UK"),
  party: commonsOfficial.party ?? targetChar.party,
  date: now,
};
await db
  .collection<Character>("characters")
  .updateOne({ _id: targetChar._id }, { $push: { careerHistory: careerEvent } });
```

## Error Responses

| Status | Condition                                                   |
| ------ | ----------------------------------------------------------- |
| 401    | Not authenticated                                           |
| 403    | Not PM, wrong party, already holds position, not in Commons |
| 404    | Character or position not found                             |
| 409    | Position already filled, on cooldown                        |

## Related Systems

- **UK Government Formation:** `src/lib/turn/uk/governmentFormation.ts` - How PM/government is formed
- **Coalitions:** `src/app/api/coalitions/` - Coalition management
- **Career History:** `src/lib/db/types/character.ts` - Office type definitions
- **Countries Config:** `src/lib/constants/countries.ts` - UK country configuration
