import { describe, expect, it } from "vitest";
import { isPublicGitHubRepoPage } from "./repo-visibility";

describe("isPublicGitHubRepoPage", () => {
	it("detects a public repository page from GitHub HTML markers", () => {
		const html = `
			<html>
				<head>
					<meta property="og:title" content="GitHub - thejasonxie/private-github-link: Share private repos" />
					<meta name="octolytics-dimension-repository_nwo" content="thejasonxie/private-github-link" />
				</head>
			</html>
		`;

		expect(
			isPublicGitHubRepoPage(html, "thejasonxie", "private-github-link"),
		).toBe(true);
	});

	it("treats non-repo pages as not publicly visible", () => {
		const html = `
			<html>
				<head>
					<title>Page not found · GitHub</title>
				</head>
				<body>
					<h1>Not Found</h1>
				</body>
			</html>
		`;

		expect(isPublicGitHubRepoPage(html, "thejasonxie", "resume-asdfsd")).toBe(
			false,
		);
	});
});
