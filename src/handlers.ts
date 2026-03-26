// Event handlers — add your business logic here.
// Each handler receives a typed event and can perform side effects
// (send push notifications, update a database, call external APIs, etc.)

import { sendToDiscord } from "./discord"
import type {
	BountyAllocatedEvent,
	BountyInterestEvent,
	BountyPayoutEvent,
	GeoWebhookEvent,
	ProposalCreatedEvent,
	ProposalExecutedEvent,
	ProposalRejectedEvent,
	ProposalSettingsUpdatedEvent,
	ProposalUpdatedEvent,
	ProposalVotedEvent,
} from "./types"

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

function handleProposalCreated(event: ProposalCreatedEvent): void {
	console.log(
		`[proposal_created] proposal=${event.proposal_id} space=${event.space_id} proposer=${event.proposer_id} → user=${event.user_space_id}`,
	)
}

function handleProposalUpdated(event: ProposalUpdatedEvent): void {
	console.log(
		`[proposal_updated] proposal=${event.proposal_id} space=${event.space_id} → user=${event.user_space_id}`,
	)
}

function handleProposalVoted(event: ProposalVotedEvent): void {
	console.log(
		`[proposal_voted] proposal=${event.proposal_id} voter=${event.voter_id} vote=${event.vote} → user=${event.user_space_id}`,
	)
}

function handleProposalExecuted(event: ProposalExecutedEvent): void {
	console.log(`[proposal_executed] proposal=${event.proposal_id} → user=${event.user_space_id}`)
}

function handleProposalSettingsUpdated(event: ProposalSettingsUpdatedEvent): void {
	console.log(`[proposal_settings_updated] proposal=${event.proposal_id} → user=${event.user_space_id}`)
}

function handleProposalRejected(event: ProposalRejectedEvent): void {
	console.log(`[proposal_rejected] proposal=${event.proposal_id} → user=${event.user_space_id}`)
}

function handleBountyInterest(event: BountyInterestEvent): void {
	console.log(
		`[bounty_interest] bounty=${event.bounty_entity_id} curator=${event.curator_space_id} → user=${event.user_space_id}`,
	)
}

function handleBountyAllocated(event: BountyAllocatedEvent): void {
	console.log(
		`[bounty_allocated] bounty=${event.bounty_entity_id} curator=${event.curator_space_id} → user=${event.user_space_id}`,
	)
}

function handleBountyPayout(event: BountyPayoutEvent): void {
	console.log(
		`[bounty_payout] bounty=${event.bounty_entity_id} curator=${event.curator_space_id} → user=${event.user_space_id}`,
	)
}

export async function handleEvent(event: GeoWebhookEvent): Promise<void> {
	switch (event.event_type) {
		case "proposal_created":
			handleProposalCreated(event)
			break
		case "proposal_updated":
			handleProposalUpdated(event)
			break
		case "proposal_voted":
			handleProposalVoted(event)
			break
		case "proposal_executed":
			handleProposalExecuted(event)
			break
		case "proposal_settings_updated":
			handleProposalSettingsUpdated(event)
			break
		case "proposal_rejected":
			handleProposalRejected(event)
			break
		case "bounty_interest":
			handleBountyInterest(event)
			break
		case "bounty_allocated":
			handleBountyAllocated(event)
			break
		case "bounty_payout":
			handleBountyPayout(event)
			break
		default:
			console.warn(`[unknown event_type] ${(event as { event_type: string }).event_type}`)
	}

	if (DISCORD_WEBHOOK_URL) {
		try {
			await sendToDiscord(DISCORD_WEBHOOK_URL, event)
		} catch (err) {
			console.error("[discord] failed to send, continuing", err)
		}
	}
}
