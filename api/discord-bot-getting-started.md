# Getting Started: Build a Discord Bot

A walkthrough for building a Discord bot on top of the A House Divided public API: slash commands that look up politicians, parties, elections, and markets, plus optional automation (fund transfers) with a private key.

Read [Public API v1](public-v1.html) first for authentication and the full endpoint reference.

## Prerequisites

- A Discord application and bot token (Discord Developer Portal -> New Application -> Bot)
- A personal API key. In-game: Settings -> API Keys.
  - **Public** scope (`ahd_pub_...`) for lookups. All you need for a read-only bot.
  - **Private** scope (`ahd_priv_...`) only if the bot sends funds. Treat it like a password.
- Node.js 20+ and discord.js (Python + discord.py works the same way conceptually)

## Step 1: Wire up the bot skeleton

```js
import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => console.log(`logged in as ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);
```

No message-content intents needed if you use slash commands, which is what you should use: they give you autocomplete, typed arguments, and per-guild permissions for free.

## Step 2: Register a lookup command

```js
import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "dotenv";
config();

const commands = [
  new SlashCommandBuilder()
    .setName("politician")
    .setDescription("Look up a politician")
    .addStringOption(o => o.setName("name").setDescription("Character name").setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.GUILD_ID), { body: commands });
```

## Step 3: Call the API from command handlers

```js
const BASE = "https://ahousedividedgame.com";
const apiHeaders = { "X-API-Key": process.env.AHD_API_KEY };

async function findCharacter(name) {
  const res = await fetch(`${BASE}/api/public/v1/character?name=${encodeURIComponent(name)}`, { headers: apiHeaders });
  if (res.status === 429) return { retryAfter: Number(res.headers.get("Retry-After") ?? 60) };
  return res.json();
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "politician") return;

  await interaction.deferReply(); // lookups can take a second; defer avoids the "thinking forever" failure

  const data = await findCharacter(interaction.options.getString("name"));
  if (!data.found || data.characters.length === 0) {
    return interaction.editReply("No match found.");
  }

  const c = data.characters[0];
  const embed = {
    title: c.name,
    description: c.bio?.slice(0, 300) ?? null,
    color: parseInt(c.partyColor.replace("#", ""), 16),
    fields: [
      { name: "Party", value: c.party, inline: true },
      { name: "Position", value: c.position || "None", inline: true },
      { name: "State", value: c.state, inline: true },
      { name: "PI", value: String(c.politicalInfluence), inline: true },
      { name: "NPI", value: String(c.nationalInfluence), inline: true },
      { name: "Favorability", value: String(c.favorability), inline: true },
    ],
  };
  await interaction.editReply({ embeds: [embed] });
});
```

Use embeds. They render better than markdown text and keep long responses compact.

## Step 4: Handle rate limits like a guest

Your bot shares one API key across every user who invokes it. Ten people running `/market` at once is ten requests against your quota:

- Back off on 429 using `Retry-After`
- Cache aggressively: party colors, country lists, and market snapshots barely change between turns
- Reply with "rate limited, try again in Ns" instead of silently failing

```js
const cache = new Map(); // key -> { data, expiresAt }
async function cachedGet(path, ttlMs = 120_000) {
  const hit = cache.get(path);
  if (hit && hit.expiresAt > Date.now()) return hit.data;
  const data = await fetch(`${BASE}${path}`, { headers: apiHeaders }).then(r => r.json());
  cache.set(path, { data, expiresAt: Date.now() + ttlMs });
  return data;
}
```

## Step 5 (optional): Fund transfers

If your bot moves money, it needs a **private** key and must respect every in-game rule: minimum 1,000, same-country only, cooldowns apply. The API enforces all of them; do not build around them.

```js
async function sendFunds(targetCharacterId, amount) {
  const res = await fetch(`${BASE}/api/v1/transfer`, {
    method: "POST",
    headers: { ...apiHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ targetCharacterId, amount }),
  });
  return res.json(); // { success, amount, currency, senderRemainingFunds, targetName } or error
}
```

Operational rules for bots that hold a private key:

- Confirm before executing. A slash command with a confirmation button beats a typo sending someone's treasury.
- Log every transfer to a private audit channel.
- One key per bot. If it leaks, revoke that key without taking down anything else.
- The key belongs in environment variables or a secrets manager, never in the repo.

## Command ideas that work well

| Command | Endpoints |
| --- | --- |
| `/politician <name>` | character search |
| `/party <id> <country>` | party detail |
| `/elections [country]` | elections list + detail |
| `/market <sector> <country>` | market |
| `/bills <country>` | legislation (pending/passed) |
| `/turn` | game state clock |
| `/leaderboard [metric]` | leaderboard |

Start with two or three. A bot that does `/turn`, `/politician`, and `/elections` reliably is more used than one with fifteen flaky commands.

## Checklist before you ship

- Public-scope key unless the bot genuinely needs to move money
- Key in env vars, never committed; Discord token likewise
- `deferReply()` on any handler that fetches
- Caching plus 429 backoff
- Errors reply to the user ("lookup failed") rather than throwing into the void
