import { createFileRoute } from "@tanstack/react-router";
import {
	isPublicGitHubRepoPage,
	type RepoVisibilityResult,
} from "@/lib/github/repo-visibility";

export const Route = createFileRoute("/api/repo-visibility")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const owner = url.searchParams.get("owner")?.trim();
				const repo = url.searchParams.get("repo")?.trim();

				if (!owner || !repo) {
					return Response.json(
						{ error: "owner and repo are required" },
						{ status: 400 },
					);
				}

				const repoUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

				try {
					const response = await fetch(repoUrl, {
						headers: {
							"User-Agent": "private-github-link/1.0",
							Accept: "text/html,application/xhtml+xml",
						},
						redirect: "follow",
					});

					const html = response.ok ? await response.text() : "";
					const result: RepoVisibilityResult = {
						visibility:
							response.ok && isPublicGitHubRepoPage(html, owner, repo)
								? "public"
								: "private-or-missing",
					};

					return Response.json(result);
				} catch (error) {
					console.error(
						"[repo-visibility] Failed to fetch GitHub HTML:",
						error,
					);
					return Response.json({ visibility: "private-or-missing" });
				}
			},
		},
	},
});
