import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { IdempotencyStore } from "../src/dedup";
import { sendToDiscord } from "../src/discord";
import { handleEvent } from "../src/handlers";
import { verifySignature } from "../src/signature";
import type { BountyInterestEvent, GeoWebhookEvent } from "../src/types";

const SECRET = "test-secret-key";

async function sign(body: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
	]);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
	const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `sha256=${hex}`;
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
	});
}

// Build an isolated app instance for testing
function createApp() {
	const app = new Hono();
	const dedup = new IdempotencyStore();

	app.get("/health", (c) => c.json({ status: "ok" }));

	app.post("/webhooks/geo", async (c) => {
		const signatureHeader = c.req.header("x-geo-signature");
		if (!signatureHeader) {
			return c.text("missing signature", 401);
		}

		const rawBody = await c.req.arrayBuffer();

		if (!(await verifySignature(rawBody, SECRET, signatureHeader))) {
			return c.text("invalid signature", 401);
		}

		const event: GeoWebhookEvent = JSON.parse(new TextDecoder().decode(rawBody));

		if (dedup.has(event.idempotency_key)) {
			return c.text("duplicate", 409);
		}

		await handleEvent(event);
		dedup.add(event.idempotency_key);
		return c.text("ok", 200);
	});

	return app;
}

describe("webhook endpoint", () => {
	const app = createApp();

	test("rejects missing signature", async () => {
		const res = await app.request("/webhooks/geo", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: makeEvent(),
		});
		expect(res.status).toBe(401);
	});

	test("rejects invalid signature", async () => {
		const body = makeEvent();
		const res = await app.request("/webhooks/geo", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-geo-signature": "sha256=0000000000000000000000000000000000000000000000000000000000000000",
			},
			body,
		});
		expect(res.status).toBe(401);
	});

	test("accepts valid signature and returns 200", async () => {
		const body = makeEvent();
		const res = await app.request("/webhooks/geo", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-geo-signature": await sign(body, SECRET),
			},
			body,
		});
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("ok");
	});

	test("returns 409 for duplicate idempotency key", async () => {
		const key = `dedup-test:${Date.now()}`;
		const body = makeEvent({ idempotency_key: key });
		const sig = await sign(body, SECRET);
		const headers = {
			"content-type": "application/json",
			"x-geo-signature": sig,
		};

		const first = await app.request("/webhooks/geo", { method: "POST", headers, body });
		expect(first.status).toBe(200);

		const second = await app.request("/webhooks/geo", { method: "POST", headers, body });
		expect(second.status).toBe(409);
	});

	test("health check returns ok", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ status: "ok" });
	});
});

describe("signature verification", () => {
	test("valid signature passes", async () => {
		const body = "test payload";
		const buf = new TextEncoder().encode(body).buffer;
		const sig = await sign(body, SECRET);
		expect(await verifySignature(buf, SECRET, sig)).toBe(true);
	});

	test("wrong secret fails", async () => {
		const body = "test payload";
		const buf = new TextEncoder().encode(body).buffer;
		const sig = await sign(body, "wrong-secret");
		expect(await verifySignature(buf, SECRET, sig)).toBe(false);
	});

	test("missing prefix fails", async () => {
		const body = "test payload";
		const buf = new TextEncoder().encode(body).buffer;
		expect(await verifySignature(buf, SECRET, "no-prefix-here")).toBe(false);
	});
});

describe("bounty events", () => {
	const app = createApp();

	function makeBountyEvent(eventType: string, overrides: Record<string, unknown> = {}) {
		const base = {
			version: 1,
			event_type: eventType,
			category: "bounty",
			space_id: "aaaaaaaa-1111-2222-3333-444444444444",
			bounty_entity_id: "bbbbbbbb-1111-2222-3333-444444444444",
			relation_id: "cccccccc-1111-2222-3333-444444444444",
			curator_space_id: "dddddddd-1111-2222-3333-444444444444",
			bounty_space_id: "eeeeeeee-1111-2222-3333-444444444444",
			user_space_id: "ffffffff-1111-2222-3333-444444444444",
			idempotency_key: `${eventType}:test:${Date.now()}:${Math.random()}`,
			block_number: 50000,
			timestamp: Math.floor(Date.now() / 1000),
			...overrides,
		};
		return JSON.stringify(base);
	}

	test("bounty_interest event returns 200", async () => {
		const body = makeBountyEvent("bounty_interest", {
			interested_user_space_id: "11111111-aaaa-bbbb-cccc-dddddddddddd",
			bounty_name: "Improve search ranking",
			curator_name: "Curator DAO",
			space_name: "Geo Genesis",
		});
		const res = await app.request("/webhooks/geo", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-geo-signature": await sign(body, SECRET),
			},
			body,
		});
		expect(res.status).toBe(200);
	});

	test("bounty_allocated event returns 200", async () => {
		const body = makeBountyEvent("bounty_allocated", {
			proposal_id: "22222222-aaaa-bbbb-cccc-dddddddddddd",
			bounty_name: "Write SDK docs",
			curator_name: "Docs Team",
		});
		const res = await app.request("/webhooks/geo", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-geo-signature": await sign(body, SECRET),
			},
			body,
		});
		expect(res.status).toBe(200);
	});

	test("bounty_payout event returns 200", async () => {
		const body = makeBountyEvent("bounty_payout", {
			proposal_id: "33333333-aaaa-bbbb-cccc-dddddddddddd",
		});
		const res = await app.request("/webhooks/geo", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-geo-signature": await sign(body, SECRET),
			},
			body,
		});
		expect(res.status).toBe(200);
	});

	test("bounty event without optional name fields returns 200", async () => {
		const body = makeBountyEvent("bounty_interest", {
			interested_user_space_id: "44444444-aaaa-bbbb-cccc-dddddddddddd",
		});
		const res = await app.request("/webhooks/geo", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-geo-signature": await sign(body, SECRET),
			},
			body,
		});
		expect(res.status).toBe(200);
	});

	test("bounty event deduplication works", async () => {
		const key = `bounty-dedup:${Date.now()}`;
		const body = makeBountyEvent("bounty_payout", {
			idempotency_key: key,
			proposal_id: "55555555-aaaa-bbbb-cccc-dddddddddddd",
		});
		const sig = await sign(body, SECRET);
		const headers = {
			"content-type": "application/json",
			"x-geo-signature": sig,
		};

		const first = await app.request("/webhooks/geo", { method: "POST", headers, body });
		expect(first.status).toBe(200);

		const second = await app.request("/webhooks/geo", { method: "POST", headers, body });
		expect(second.status).toBe(409);
	});
});

describe("discord embed formatting", () => {
	test("bounty event fields include geobrowser entity links", async () => {
		const calls: { url: string; body: string }[] = [];
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
			calls.push({ url: String(input), body: init?.body as string });
			return new Response("ok", { status: 204 });
		};

		try {
			const event: BountyInterestEvent = {
				version: 1,
				event_type: "bounty_interest",
				category: "bounty",
				space_id: "space-aaa",
				bounty_entity_id: "entity-bbb",
				relation_id: "rel-ccc",
				curator_space_id: "curator-ddd",
				bounty_space_id: "bspace-eee",
				interested_user_space_id: "user-fff",
				bounty_name: "Fix search",
				curator_name: "Curator DAO",
				idempotency_key: "test:discord:1",
				timestamp: 1700000000,
			};

			await sendToDiscord("https://discord.test/webhook", event);

			expect(calls).toHaveLength(1);
			const payload = JSON.parse(calls[0].body);
			const fields: { name: string; value: string }[] = payload.embeds[0].fields;

			const entityField = fields.find((f) => f.name === "bounty_entity_id");
			expect(entityField?.value).toContain("geobrowser.io/space/bspace-eee/entity-bbb");

			const curatorField = fields.find((f) => f.name === "curator_space_id");
			expect(curatorField?.value).toContain("geobrowser.io/space/curator-ddd");

			const spaceField = fields.find((f) => f.name === "space_id");
			expect(spaceField?.value).toContain("geobrowser.io/space/space-aaa");

			// Name fields should be plain text, not links
			const nameField = fields.find((f) => f.name === "bounty_name");
			expect(nameField?.value).toBe("`Fix search`");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

describe("idempotency store", () => {
	test("tracks seen keys", () => {
		const store = new IdempotencyStore();
		expect(store.has("key1")).toBe(false);
		store.add("key1");
		expect(store.has("key1")).toBe(true);
		expect(store.has("key2")).toBe(false);
		store.close();
	});

	test("expires keys after TTL", () => {
		const store = new IdempotencyStore(1); // 1ms TTL
		store.add("key1");
		const start = Date.now();
		while (Date.now() - start < 5) {} // busy wait 5ms
		expect(store.has("key1")).toBe(false);
		store.close();
	});
});
