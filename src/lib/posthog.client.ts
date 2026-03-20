import posthog from "posthog-js";
import { getPostHogApiKey, posthogOptions } from "./posthog-config";

// Re-export posthog for use in components
export { posthog };
export { getPostHogApiKey, posthogOptions };

// Initialize PostHog imperatively (alternative to provider)
let initialized = false;

export function initPostHog() {
	if (typeof window === "undefined") return;
	if (initialized) return;

	const apiKey = getPostHogApiKey();

	if (!apiKey) {
		console.warn(
			"[PostHog] VITE_POSTHOG_API_KEY not configured, skipping initialization",
		);
		return;
	}

	posthog.init(apiKey, posthogOptions);
	initialized = true;
}
