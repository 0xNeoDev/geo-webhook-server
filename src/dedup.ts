// In-memory idempotency store with TTL-based eviction.
// For production, swap this with Redis or a database-backed store.

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const EVICTION_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

interface Entry {
	expiresAt: number
}

export class IdempotencyStore {
	private seen = new Map<string, Entry>()
	private timer: ReturnType<typeof setInterval>

	constructor(private ttlMs = DEFAULT_TTL_MS) {
		this.timer = setInterval(() => this.evict(), EVICTION_INTERVAL_MS)
	}

	/** Returns true if this key was already processed. */
	has(key: string): boolean {
		const entry = this.seen.get(key)
		if (!entry) return false
		if (Date.now() > entry.expiresAt) {
			this.seen.delete(key)
			return false
		}
		return true
	}

	add(key: string): void {
		this.seen.set(key, { expiresAt: Date.now() + this.ttlMs })
	}

	get size(): number {
		return this.seen.size
	}

	private evict(): void {
		const now = Date.now()
		for (const [key, entry] of this.seen) {
			if (now > entry.expiresAt) {
				this.seen.delete(key)
			}
		}
	}

	close(): void {
		clearInterval(this.timer)
	}
}
