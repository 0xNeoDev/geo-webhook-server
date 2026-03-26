import { Hono } from "hono"
import { IdempotencyStore } from "./dedup"
import { handleEvent } from "./handlers"
import { verifySignature } from "./signature"
import type { GeoWebhookEvent } from "./types"

const app = new Hono()
const dedup = new IdempotencyStore()

const WEBHOOK_SECRET = process.env.GEO_WEBHOOK_SECRET
if (!WEBHOOK_SECRET) {
	console.error("GEO_WEBHOOK_SECRET environment variable is required")
	process.exit(1)
}

const PORT = Number(process.env.PORT) || 3000
const MAX_BODY_BYTES = 64 * 1024 // 64 KB — webhook payloads are small JSON

// Health check
app.get("/health", (c) => c.json({ status: "ok" }))

// Webhook endpoint
app.post("/webhooks/geo", async (c) => {
	const signatureHeader = c.req.header("x-geo-signature")
	if (!signatureHeader) {
		return c.text("missing signature", 401)
	}

	// Read raw body for signature verification
	const rawBody = await c.req.arrayBuffer()

	if (rawBody.byteLength > MAX_BODY_BYTES) {
		return c.text("payload too large", 413)
	}

	if (!verifySignature(rawBody, WEBHOOK_SECRET, signatureHeader)) {
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

	await handleEvent(event)

	dedup.add(event.idempotency_key)
	return c.text("ok", 200)
})

console.log(`Geo webhook server listening on :${PORT}`)

export default {
	port: PORT,
	fetch: app.fetch,
}
