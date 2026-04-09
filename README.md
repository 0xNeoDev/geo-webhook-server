# Geo Webhook Server

Minimal webhook receiver for the [Geo notification service](https://github.com/geobrowser/gaia). Receives signed governance and bounty event notifications from the delivery-worker, forwards them as rich embeds to a Discord webhook, and deploys to Cloudflare Workers. Both the Discord integration and Cloudflare deployment are reference defaults — swap them out for your app's needs (e.g. Slack, email, AWS Lambda).

## Stack

- **Bun** — TypeScript runtime (no transpilation, fast startup)
- **Hono** — Lightweight HTTP framework
- **[@geoprotocol/geo-sdk](https://github.com/geobrowser/geo-sdk)** — Geo protocol system IDs and entity types
- **Docker** — Single-stage production image

## Quick start

```bash
# Install
bun install

# Configure
cp .env.example .env
# Edit .env with your webhook secret

# Run
bun run dev      # with hot reload
bun run start    # production

# Test
bun test
```

## Deploy

### Cloudflare Workers (default)

```bash
# Set secrets
wrangler secret put GEO_WEBHOOK_SECRET
wrangler secret put DISCORD_WEBHOOK_URL

# Deploy
bun run deploy
```

### Docker

```bash
docker build -t geo-webhook-server .
docker run -p 3000:3000 -e GEO_WEBHOOK_SECRET=your-secret geo-webhook-server
```

## How it works

1. The Geo delivery-worker POSTs a JSON payload to `/webhooks/geo`
2. The server verifies the `X-Geo-Signature` HMAC-SHA256 header
3. Duplicate events are rejected via idempotency key (returns 409)
4. The event is routed to a typed handler in `src/handlers.ts`

## Adding your logic

Edit `src/handlers.ts` — each event type has its own function. Add push notifications, database writes, Slack messages, etc.

## Event types

### Governance
- `proposal_created` — new proposal in a space (`proposal_id`, `proposer_id`)
- `proposal_updated` — proposal content changed (`proposal_id`, `proposer_id`)
- `proposal_voted` — vote cast (`proposal_id`, `voter_id`, `vote`)
- `proposal_executed` — passed proposal executed on-chain (`proposal_id`)
- `proposal_settings_updated` — voting settings changed (`proposal_id`)
- `proposal_rejected` — proposal expired without execution (`proposal_id`, `proposer_id`)

### Bounty
- `bounty_interest` — curator expressed interest in a bounty (`bounty_entity_id`, `curator_space_id`, `bounty_space_id`, `interested_user_space_id`)
- `bounty_allocated` — bounty allocated to a curator (`bounty_entity_id`, `curator_space_id`, `bounty_space_id`, `proposal_id?`)
- `bounty_payout` — bounty paid out to a curator (`bounty_entity_id`, `curator_space_id`, `bounty_space_id`, `proposal_id?`)

All events include common fields: `space_id`, `event_type`, `category`, `idempotency_key`, `block_number`, `timestamp`, and optional enrichment fields (`space_name`, `bounty_name`, `curator_name`).

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEO_WEBHOOK_SECRET` | Yes | — | Shared secret for HMAC verification |
| `DISCORD_WEBHOOK_URL` | No | — | Discord webhook URL for forwarding notifications as embeds |
| `PORT` | No | `3000` | Server port (local dev only; Cloudflare Workers ignores this) |
