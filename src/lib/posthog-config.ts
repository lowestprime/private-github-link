export const posthogOptions = {
	// Use reverse proxy to bypass blockers
	api_host: "/api/t/e",
	// Required when using a reverse proxy
	ui_host: "https://us.posthog.com",
	// Disable compression - proxy doesn't preserve gzip encoding
	disable_compression: true,
	// Capture pageviews automatically
	capture_pageview: true,
	// Capture pageleave events for accurate time-on-page
	capture_pageleave: true,
	// Disable session recording
	disable_session_recording: true,
	// Respect Do Not Track browser setting
	respect_dnt: true,
} as const;

export function getPostHogApiKey(): string | undefined {
	if (typeof window === "undefined") {
		return undefined;
	}

	return import.meta.env.VITE_POSTHOG_API_KEY;
}
