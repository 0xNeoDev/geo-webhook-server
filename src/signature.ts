// HMAC-SHA256 signature verification for Geo webhook payloads.
// The delivery-worker signs each request with: X-Geo-Signature: sha256={hmac_hex}

const SIGNATURE_PREFIX = "sha256="

export function verifySignature(rawBody: ArrayBuffer, secret: string, signatureHeader: string): boolean {
	if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
		return false
	}

	const received = signatureHeader.slice(SIGNATURE_PREFIX.length)

	const key = new Bun.CryptoHasher("sha256", secret)
	key.update(new Uint8Array(rawBody))
	const expected = key.digest("hex")

	// Constant-time comparison
	if (received.length !== expected.length) {
		return false
	}

	// Use subtle crypto for timing-safe comparison when available,
	// otherwise fall back to byte-by-byte with constant-time accumulator
	let mismatch = 0
	for (let i = 0; i < received.length; i++) {
		mismatch |= received.charCodeAt(i) ^ expected.charCodeAt(i)
	}
	return mismatch === 0
}
