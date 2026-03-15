export type RepoVisibility = "public" | "private-or-missing";

export interface RepoVisibilityResult {
	visibility: RepoVisibility;
}

export function isPublicGitHubRepoPage(
	html: string,
	owner: string,
	repo: string,
): boolean {
	const repoPath = `${owner}/${repo}`.toLowerCase();
	const normalizedHtml = html.toLowerCase();
	const encodedRepoPath = repoPath.replace(/\//g, "%2f");

	return [
		`property="og:title" content="github - ${repoPath}`,
		`name="octolytics-dimension-repository_nwo" content="${repoPath}"`,
		`href="https://github.com/${repoPath}"`,
		`content="/${repoPath}"`,
		`content="${encodedRepoPath}"`,
	].some((indicator) => normalizedHtml.includes(indicator));
}

export async function fetchRepoVisibility(
	owner: string,
	repo: string,
): Promise<RepoVisibilityResult> {
	try {
		const response = await fetch(
			`/api/repo-visibility?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
		);

		if (!response.ok) {
			return { visibility: "private-or-missing" };
		}

		const data = (await response.json()) as Partial<RepoVisibilityResult>;
		return {
			visibility:
				data.visibility === "public" ? "public" : "private-or-missing",
		};
	} catch {
		return { visibility: "private-or-missing" };
	}
}
