# UK Cabinet System

## Overview

The UK Cabinet System manages cabinet appointments for the United Kingdom government. The Prime Minister appoints and dismisses cabinet ministers from among MPs of the governing party or coalition.

**Location:** `src/lib/uk/`

**Key files:**

- `cabinetApi.ts` - API route handlers for appointments
- `cabinetEligibility.ts` - Eligibility rules and queries
- `constants.ts` - Cabinet position definitions

## Cabinet Positions

Cabinet positions are defined in `UK_CABINET_POSITIONS` (`src/lib/constants/ukCabinet.ts`):

| Position ID             | Name                           |
| ----------------------- | ------------------------------ |
| `deputy_pm`             | Deputy Prime Minister          |
| `chancellor`            | Chancellor of the Exchequer    |
| `foreign_secretary`     | Foreign Secretary              |
| `home_secretary`        | Home Secretary                 |
| `justice_secretary`     | Justice Secretary              |
| `defence_secretary`     | Defence Secretary              |
| `health_secretary`      | Health Secretary               |
| `education_secretary`   | Education Secretary            |
| `business_secretary`    | Business Secretary             |
| `energy_secretary`      | Energy Secretary               |
| `transport_secretary`   | Transport Secretary            |
| `environment_secretary` | Environment Secretary          |
| `ni_secretary`          | Northern Ireland Secretary     |
| `scotland_secretary`    | Scotland Secretary             |
| `wales_secretary`       | Wales Secretary                |
| `commons_leader`        | Leader of the House of Commons |
| `lords_leader`          | Leader of the House of Lords   |
| `council_leader`        | Lord President of the Council  |

## Eligibility Rules

### Prime Minister Authorization

Only the current Prime Minister can appoint or dismiss cabinet ministers.

```typescript
export async function requireCurrentUKPrimeMinister(
  db: Db,
  userId: ObjectId,
  errorMsg: string
): Promise<{ gov: UKGovernment; pmCharacter: Character }> {
  const gov = await getUKGovernment(db);
  if (!gov || !gov.isFormed || !gov.pmCharacterId) {
    throw forbidden(errorMsg);
  }

  const pmCharacter = await db
    .collection<Character>("characters")
    .findOne({ _id: gov.pmCharacterId });
  if (!pmCharacter || pmCharacter.userId !== userId) {
    throw forbidden(errorMsg);
  }

  return { gov, pmCharacter };
}
```

### Minister Eligibility

To be eligible for cabinet appointment:

1. **Must hold seat in House of Commons** — Lords cannot serve in cabinet
2. **Must be from governing party or coalition** — Coalition members get cabinet slots
3. **Cannot already hold cabinet position** — One position per character
4. **Cannot be the PM themselves** — PM cannot appoint themselves to additional positions

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
  const cabinetMemberIds = await getUKCabinetMembersCollection(db)
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

Authorization: requireAuth() + requireCurrentUKPrimeMinister()

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
1. Insert record into ukCabinetMembers
2. Add career history entry to character
3. Reset advocacy toggle for territorial secretaries (NI, Scotland, Wales)
```

### 3. Dismiss Minister

```typescript
POST /api/uk/cabinet/fire
Body: { positionId: string }

Authorization: requireAuth() + requireCurrentUKPrimeMinister()

Checks:
1. Position exists
2. Position is currently filled

Effects:
1. Delete record from ukCabinetMembers
2. Insert record into ukCabinetCooldowns (12-hour cooldown)
```

## Cooldown System

When a minister is dismissed, the position enters a 12-hour cooldown:

```typescript
const COOLDOWN_HOURS = 12;
const now = new Date();
const cooldownUntil = new Date(now.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);

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
| `ukCabinetMembers`   | Current cabinet ministers               |
| `ukCabinetCooldowns` | Dismissal cooldowns                     |
| `cabinetSettings`    | Per-position settings (advocacy toggle) |
| `characters`         | Career history updates                  |
| `electedOfficials`   | Commons seat verification               |

### Document Types

```typescript
interface UKCabinetMember {
  _id: ObjectId;
  countryId: "UK";
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
