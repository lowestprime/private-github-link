export type ViewType = "tree" | "blob" | "commits";

export interface ParsedRepoPath {
	owner: string;
	repo: string;
	viewType: ViewType;
	branch: string;
	path: string;
}

interface BuildRepoPreviewHrefOptions {
	accessToken?: string;
	branch: string;
	hash?: string;
	owner: string;
	path?: string;
	repo: string;
	viewType: ViewType;
}

export function buildRepoSplatPath(
	owner: string,
	repo: string,
	viewType: ViewType,
	branch: string,
	path = "",
): string {
	const normalizedPath = path.replace(/^\/+|\/+$/g, "");

	return normalizedPath
		? `${owner}/${repo}/${viewType}/${branch}/${normalizedPath}`
		: `${owner}/${repo}/${viewType}/${branch}`;
}

export function buildRepoPreviewHref({
	accessToken,
	branch,
	hash,
	owner,
	path = "",
	repo,
	viewType,
}: BuildRepoPreviewHrefOptions): string {
	const search = accessToken
		? `?access_token=${encodeURIComponent(accessToken)}`
		: "";
	const fragment = hash ? `#${encodeURIComponent(hash)}` : "";

	return `/${buildRepoSplatPath(owner, repo, viewType, branch, path)}${search}${fragment}`;
}

/**
 * Parse URL path: {owner}/{repo}/{viewType}/{branch}/{...path}
 * @param splatPath - The URL path segment to parse
 * @returns Parsed repo path object or null if invalid
 */
export function parseRepoPath(splatPath: string): ParsedRepoPath | null {
	const segments = splatPath.split("/").filter(Boolean);

	if (segments.length < 2) {
		return null;
	}

	const [owner, repo, viewType, ...rest] = segments;
	const validViewTypes: ViewType[] = ["tree", "blob", "commits"];

	if (viewType && !validViewTypes.includes(viewType as ViewType)) {
		return null;
	}

	// Only set branch if explicitly provided in URL.
	// Components should fall back to repoInfo.defaultBranch when needed.
	const branch = rest[0] || "";
	const path = rest.slice(1).join("/");

	return {
		owner,
		repo,
		viewType: (viewType as ViewType) || "tree",
		branch,
		path,
	};
}
