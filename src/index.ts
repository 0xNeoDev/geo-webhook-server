import { Hono } from "hono"
import { IdempotencyStore } from "./dedup"
import { handleEvent } from "./handlers"
import { verifySignature } from "./signature"
import type { GeoWebhookEvent } from "./types"

export type Env = {
	GEO_WEBHOOK_SECRET: string
	DISCORD_WEBHOOK_URL?: string
}

const app = new Hono<{ Bindings: Env }>()
const dedup = new IdempotencyStore()

const MAX_BODY_BYTES = 64 * 1024 // 64 KB — webhook payloads are small JSON

// Health check
app.get("/health", (c) => c.json({ status: "ok" }))

// Webhook endpoint
app.post("/webhooks/geo", async (c) => {
	const secret = c.env.GEO_WEBHOOK_SECRET
	if (!secret) {
		return c.text("server misconfigured: missing GEO_WEBHOOK_SECRET", 500)
	}

	const signatureHeader = c.req.header("x-geo-signature")
	if (!signatureHeader) {
		return c.text("missing signature", 401)
	}

	// Read raw body for signature verification
	const rawBody = await c.req.arrayBuffer()

	if (rawBody.byteLength > MAX_BODY_BYTES) {
		return c.text("payload too large", 413)
	}

	if (!(await verifySignature(rawBody, secret, signatureHeader))) {
		return c.text("invalid signature", 401)
	}

	const raw = new TextDecoder().decode(rawBody)
	console.log("[payload]", raw)
	const event: GeoWebhookEvent = JSON.parse(raw)

	if (!event.idempotency_key) {
		return c.text("missing idempotency_key", 400)
	}

	// Idempotency check
	if (dedup.has(event.idempotency_key)) {
		return c.text("duplicate", 409)
	}

	await handleEvent(event, c.env.DISCORD_WEBHOOK_URL)

	dedup.add(event.idempotency_key)
	return c.text("ok", 200)
})

export default app
