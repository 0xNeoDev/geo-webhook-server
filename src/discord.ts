// Discord webhook adapter — formats Geo notification events as rich embeds.
// Forwards ALL payload fields as embed fields, with entity/space IDs linked to geobrowser.io.

import type { GeoWebhookEvent } from "./types";

const GEO_BROWSER_BASE = "https://www.geobrowser.io/space";

// Fields that represent a space (link to space root)
const SPACE_FIELDS = new Set([
	"space_id",
	"bounty_space_id",
	"curator_space_id",
	"user_space_id",
	"interested_user_space_id",
]);

// Fields that represent an entity within a space (need a space context for the link)
const ENTITY_FIELDS: Record<string, string> = {
	proposal_id: "space_id",
	bounty_entity_id: "bounty_space_id",
};

function geoSpaceUrl(spaceId: string): string {
	return `${GEO_BROWSER_BASE}/${spaceId}`;
}

function geoEntityUrl(spaceId: string, entityId: string): string {
	return `${GEO_BROWSER_BASE}/${spaceId}/${entityId}`;
}

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
};

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
};

// Fields to show in the title/footer/timestamp rather than as embed fields
const META_KEYS = new Set(["event_type", "version", "idempotency_key", "timestamp"]);

function buildFields(event: GeoWebhookEvent): Array<{ name: string; value: string; inline: boolean }> {
	const fields: Array<{ name: string; value: string; inline: boolean }> = [];
	const entries = Object.entries(event) as [string, unknown][];

	for (const [key, value] of entries) {
		if (META_KEYS.has(key) || value == null) continue;

		let formatted: string;
		let inline = true;
		if (typeof value === "object") {
			const json = JSON.stringify(value, null, 2);
			formatted = `\`\`\`json\n${json.slice(0, 1014)}\n\`\`\``;
			inline = false;
		} else if (SPACE_FIELDS.has(key) && typeof value === "string") {
			formatted = `[\`${value}\`](${geoSpaceUrl(value)})`;
		} else if (key in ENTITY_FIELDS && typeof value === "string") {
			const spaceKey = ENTITY_FIELDS[key];
			const spaceId = (event as Record<string, unknown>)[spaceKey];
			if (typeof spaceId === "string") {
				formatted = `[\`${value}\`](${geoEntityUrl(spaceId, value)})`;
			} else {
				formatted = `\`${value}\``;
			}
		} else {
			formatted = `\`${value}\``;
		}

		fields.push({ name: key, value: formatted, inline });
	}

	return fields;
}

export async function sendToDiscord(webhookUrl: string, event: GeoWebhookEvent): Promise<void> {
	const payload = {
		embeds: [
			{
				title: EVENT_LABELS[event.event_type] ?? event.event_type,
				color: EVENT_COLORS[event.event_type] ?? 0x95a5a6,
				fields: buildFields(event),
				footer: {
					text:
						[event.version != null ? `v${event.version}` : null, event.idempotency_key].filter(Boolean).join(" · ") ||
						event.event_type,
				},
				...(event.timestamp ? { timestamp: new Date(event.timestamp * 1000).toISOString() } : {}),
			},
		],
	};

	const res = await fetch(webhookUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		console.error(`Discord webhook failed: ${res.status} ${await res.text()}`);
	}
}
