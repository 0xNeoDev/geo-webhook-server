// Discord webhook adapter — formats Geo notification events as rich embeds.
// Forwards ALL payload fields as embed fields.

import type { GeoWebhookEvent } from "./types"

const EVENT_LABELS: Record<string, string> = {
	proposal_created: "Proposal Created",
	proposal_updated: "Proposal Updated",
	proposal_voted: "Vote Cast",
	proposal_executed: "Proposal Executed",
	proposal_settings_updated: "Settings Updated",
	proposal_rejected: "Proposal Rejected",
	bounty_interest: "Bounty Interest",
	bounty_allocated: "Bounty Allocated",
	bounty_payout: "Bounty Payout",
}

const EVENT_COLORS: Record<string, number> = {
	proposal_created: 0x5865f2, // blurple
	proposal_updated: 0xfee75c, // yellow
	proposal_voted: 0x57f287, // green
	proposal_executed: 0x57f287, // green
	proposal_settings_updated: 0xfee75c, // yellow
	proposal_rejected: 0xed4245, // red
	bounty_interest: 0x5865f2, // blurple
	bounty_allocated: 0x57f287, // green
	bounty_payout: 0xeb459e, // fuchsia
}

// Fields to show in the title/footer/timestamp rather than as embed fields
const META_KEYS = new Set(["event_type", "version", "idempotency_key", "timestamp"])

function buildFields(event: GeoWebhookEvent): Array<{ name: string; value: string; inline: boolean }> {
	const fields: Array<{ name: string; value: string; inline: boolean }> = []

	for (const [key, value] of Object.entries(event)) {
		if (META_KEYS.has(key) || value == null) continue

		let formatted: string
		let inline = true
		if (typeof value === "object") {
			// Nested objects (e.g. settings) — render as compact JSON code block
			const json = JSON.stringify(value, null, 2)
			formatted = `\`\`\`json\n${json.slice(0, 1014)}\n\`\`\``
			inline = false
		} else {
			formatted = `\`${value}\``
		}

		fields.push({ name: key, value: formatted, inline })
	}

	return fields
}

export async function sendToDiscord(webhookUrl: string, event: GeoWebhookEvent): Promise<void> {
	const payload = {
		embeds: [
			{
				title: EVENT_LABELS[event.event_type] ?? event.event_type,
				color: EVENT_COLORS[event.event_type] ?? 0x95a5a6,
				fields: buildFields(event),
				footer: {
					text: [event.version != null ? `v${event.version}` : null, event.idempotency_key]
						.filter(Boolean)
						.join(" · ") || event.event_type,
				},
				...(event.timestamp ? { timestamp: new Date(event.timestamp * 1000).toISOString() } : {}),
			},
		],
	}

	const res = await fetch(webhookUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	})

	if (!res.ok) {
		console.error(`Discord webhook failed: ${res.status} ${await res.text()}`)
	}
}
