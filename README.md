# Geo Webhook Server

Minimal webhook receiver for the [Geo notification service](https://github.com/geobrowser/gaia). Receives signed governance and bounty event notifications from the delivery-worker and processes them.

## Stack

- **Bun** — TypeScript runtime (no transpilation, fast startup)
- **Hono** — Lightweight HTTP framework
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

## Deploy with Docker

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
- `proposal_created` — new proposal in a space
- `proposal_updated` — proposal content changed
- `proposal_voted` — vote cast (includes `vote` and `voter_id`)
- `proposal_executed` — passed proposal executed on-chain
- `proposal_settings_updated` — voting settings changed
- `proposal_rejected` — proposal expired without execution

### Bounty
- `bounty_interest` — curator expressed interest in a bounty
- `bounty_allocated` — bounty allocated to a curator
- `bounty_payout` — bounty paid out to a curator

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEO_WEBHOOK_SECRET` | Yes | — | Shared secret for HMAC verification |
| `PORT` | No | `3000` | Server port |
