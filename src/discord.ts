// Discord webhook adapter — formats Geo notification events as rich embeds.

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

function buildFields(event: GeoWebhookEvent): Array<{ name: string; value: string; inline: boolean }> {
	const fields: Array<{ name: string; value: string; inline: boolean }> = [
		{ name: "Space", value: `\`${event.space_id}\``, inline: true },
		{ name: "User", value: `\`${event.user_space_id}\``, inline: true },
	]

	if ("proposal_id" in event) {
		fields.push({ name: "Proposal", value: `\`${event.proposal_id}\``, inline: true })
	}
	if ("proposer_id" in event) {
		fields.push({ name: "Proposer", value: `\`${event.proposer_id}\``, inline: true })
	}
	if ("voter_id" in event) {
		fields.push({ name: "Voter", value: `\`${event.voter_id}\``, inline: true })
	}
	if ("vote" in event) {
		fields.push({ name: "Vote", value: event.vote, inline: true })
	}
	if ("bounty_entity_id" in event) {
		fields.push({ name: "Bounty", value: `\`${event.bounty_entity_id}\``, inline: true })
	}
	if ("curator_space_id" in event) {
		fields.push({ name: "Curator", value: `\`${event.curator_space_id}\``, inline: true })
	}
	if (event.block_number != null) {
		fields.push({ name: "Block", value: `${event.block_number}`, inline: true })
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
				footer: { text: [event.version != null ? `v${event.version}` : null, event.idempotency_key].filter(Boolean).join(" · ") || event.event_type },
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
