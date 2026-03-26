import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { IdempotencyStore } from "../src/dedup"
import { handleEvent } from "../src/handlers"
import { verifySignature } from "../src/signature"
import type { GeoWebhookEvent } from "../src/types"

const SECRET = "test-secret-key"

function sign(body: string, secret: string): string {
	const hasher = new Bun.CryptoHasher("sha256", secret)
	hasher.update(body)
	return `sha256=${hasher.digest("hex")}`
}

function makeEvent(overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		version: 1,
		event_type: "proposal_created",
		space_id: "aaaaaaaa-1111-2222-3333-444444444444",
		proposal_id: "bbbbbbbb-1111-2222-3333-444444444444",
		user_space_id: "cccccccc-1111-2222-3333-444444444444",
		idempotency_key: `proposal_created:test:${Date.now()}:${Math.random()}`,
		proposer_id: "dddddddd-1111-2222-3333-444444444444",
		block_number: 12345,
		timestamp: Math.floor(Date.now() / 1000),
		...overrides,
	})
}

// Build an isolated app instance for testing
function createApp() {
	const app = new Hono()
	const dedup = new IdempotencyStore()

	app.get("/health", (c) => c.json({ status: "ok" }))

	app.post("/webhooks/geo", async (c) => {
		const signatureHeader = c.req.header("x-geo-signature")
		if (!signatureHeader) {
			return c.text("missing signature", 401)
		}

		const rawBody = await c.req.arrayBuffer()

		if (!verifySignature(rawBody, SECRET, signatureHeader)) {
			return c.text("invalid signature", 401)
		}

		const event: GeoWebhookEvent = JSON.parse(new TextDecoder().decode(rawBody))

		if (dedup.has(event.idempotency_key)) {
			return c.text("duplicate", 409)
		}

		handleEvent(event)
		dedup.add(event.idempotency_key)
		return c.text("ok", 200)
	})

	return app
}

describe("webhook endpoint", () => {
	const app = createApp()

	test("rejects missing signature", async () => {
		const res = await app.request("/webhooks/geo", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: makeEvent(),
		})
		expect(res.status).toBe(401)
	})

	test("rejects invalid signature", async () => {
		const body = makeEvent()
		const res = await app.request("/webhooks/geo", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-geo-signature": "sha256=0000000000000000000000000000000000000000000000000000000000000000",
			},
			body,
		})
		expect(res.status).toBe(401)
	})

	test("accepts valid signature and returns 200", async () => {
		const body = makeEvent()
		const res = await app.request("/webhooks/geo", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-geo-signature": sign(body, SECRET),
			},
			body,
		})
		expect(res.status).toBe(200)
		expect(await res.text()).toBe("ok")
	})

	test("returns 409 for duplicate idempotency key", async () => {
		const key = `dedup-test:${Date.now()}`
		const body = makeEvent({ idempotency_key: key })
		const sig = sign(body, SECRET)
		const headers = {
			"content-type": "application/json",
			"x-geo-signature": sig,
		}

		const first = await app.request("/webhooks/geo", { method: "POST", headers, body })
		expect(first.status).toBe(200)

		const second = await app.request("/webhooks/geo", { method: "POST", headers, body })
		expect(second.status).toBe(409)
	})

	test("health check returns ok", async () => {
		const res = await app.request("/health")
		expect(res.status).toBe(200)
		const json = await res.json()
		expect(json).toEqual({ status: "ok" })
	})
})

describe("signature verification", () => {
	test("valid signature passes", () => {
		const body = "test payload"
		const encoder = new TextEncoder()
		const buf = encoder.encode(body).buffer
		const sig = sign(body, SECRET)
		expect(verifySignature(buf, SECRET, sig)).toBe(true)
	})

	test("wrong secret fails", () => {
		const body = "test payload"
		const encoder = new TextEncoder()
		const buf = encoder.encode(body).buffer
		const sig = sign(body, "wrong-secret")
		expect(verifySignature(buf, SECRET, sig)).toBe(false)
	})

	test("missing prefix fails", () => {
		const body = "test payload"
		const encoder = new TextEncoder()
		const buf = encoder.encode(body).buffer
		expect(verifySignature(buf, SECRET, "no-prefix-here")).toBe(false)
	})
})

describe("idempotency store", () => {
	test("tracks seen keys", () => {
		const store = new IdempotencyStore()
		expect(store.has("key1")).toBe(false)
		store.add("key1")
		expect(store.has("key1")).toBe(true)
		expect(store.has("key2")).toBe(false)
		store.close()
	})

	test("expires keys after TTL", () => {
		const store = new IdempotencyStore(1) // 1ms TTL
		store.add("key1")
		// Wait for expiry
		const start = Date.now()
		while (Date.now() - start < 5) {} // busy wait 5ms
		expect(store.has("key1")).toBe(false)
		store.close()
	})
})
