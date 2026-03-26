// Geo notification webhook event types
// See: notification-service/WEBHOOK_INTEGRATION.md

export type GovernanceEventType =
	| "proposal_created"
	| "proposal_updated"
	| "proposal_voted"
	| "proposal_executed"
	| "proposal_settings_updated"
	| "proposal_rejected"

export type BountyEventType = "bounty_interest" | "bounty_allocated" | "bounty_payout"

export type EventType = GovernanceEventType | BountyEventType

// Fields present on every event
export interface BaseEvent {
	version: number
	event_type: EventType
	space_id: string
	user_space_id: string
	idempotency_key: string
	block_number?: number // absent for proposal_rejected
	timestamp: number
}

// Governance events
export interface ProposalCreatedEvent extends BaseEvent {
	event_type: "proposal_created"
	proposal_id: string
	proposer_id: string
}

export interface ProposalUpdatedEvent extends BaseEvent {
	event_type: "proposal_updated"
	proposal_id: string
	proposer_id: string
}

export interface ProposalVotedEvent extends BaseEvent {
	event_type: "proposal_voted"
	proposal_id: string
	voter_id: string
	vote: "yes" | "no" | "abstain"
}

export interface ProposalExecutedEvent extends BaseEvent {
	event_type: "proposal_executed"
	proposal_id: string
}

export interface ProposalSettingsUpdatedEvent extends BaseEvent {
	event_type: "proposal_settings_updated"
	proposal_id: string
}

export interface ProposalRejectedEvent extends BaseEvent {
	event_type: "proposal_rejected"
	proposal_id: string
	proposer_id: string
}

// Bounty events
export interface BountyInterestEvent extends BaseEvent {
	event_type: "bounty_interest"
	bounty_entity_id: string
	relation_id: string
	curator_space_id: string
	bounty_space_id: string
	interested_user_space_id: string
}

export interface BountyAllocatedEvent extends BaseEvent {
	event_type: "bounty_allocated"
	bounty_entity_id: string
	relation_id: string
	curator_space_id: string
	bounty_space_id: string
	proposal_id: string
}

export interface BountyPayoutEvent extends BaseEvent {
	event_type: "bounty_payout"
	bounty_entity_id: string
	relation_id: string
	curator_space_id: string
	bounty_space_id: string
	proposal_id: string
}

export type GeoWebhookEvent =
	| ProposalCreatedEvent
	| ProposalUpdatedEvent
	| ProposalVotedEvent
	| ProposalExecutedEvent
	| ProposalSettingsUpdatedEvent
	| ProposalRejectedEvent
	| BountyInterestEvent
	| BountyAllocatedEvent
	| BountyPayoutEvent
