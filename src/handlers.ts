// Event handlers — add your business logic here.
// Each handler receives a typed event and can perform side effects
// (send push notifications, update a database, call external APIs, etc.)

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

export function handleEvent(event: GeoWebhookEvent): void {
	switch (event.event_type) {
		case "proposal_created":
			return handleProposalCreated(event)
		case "proposal_updated":
			return handleProposalUpdated(event)
		case "proposal_voted":
			return handleProposalVoted(event)
		case "proposal_executed":
			return handleProposalExecuted(event)
		case "proposal_settings_updated":
			return handleProposalSettingsUpdated(event)
		case "proposal_rejected":
			return handleProposalRejected(event)
		case "bounty_interest":
			return handleBountyInterest(event)
		case "bounty_allocated":
			return handleBountyAllocated(event)
		case "bounty_payout":
			return handleBountyPayout(event)
	}
}
