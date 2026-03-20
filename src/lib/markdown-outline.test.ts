import { describe, expect, it } from "vitest";
import {
	extractMarkdownHeadings,
	findMarkdownAnchorTarget,
	normalizeMarkdownHash,
} from "./markdown-outline";

describe("extractMarkdownHeadings", () => {
	it("should generate GitHub-style slugs with duplicates and unicode preserved", () => {
		expect(
			extractMarkdownHeadings(
				"# Hello World\n## Hello World\n### This'll be a Helpful Section About the Greek Letter Θ!",
			),
		).toEqual([
			{ depth: 1, id: "hello-world", text: "Hello World" },
			{ depth: 2, id: "hello-world-1", text: "Hello World" },
			{
				depth: 3,
				id: "thisll-be-a-helpful-section-about-the-greek-letter-θ",
				text: "This'll be a Helpful Section About the Greek Letter Θ!",
			},
		]);
	});
});

describe("normalizeMarkdownHash", () => {
	it("should decode and strip the leading hash", () => {
		expect(normalizeMarkdownHash("#hello-world")).toBe("hello-world");
		expect(normalizeMarkdownHash("#smart%20quotes")).toBe("smart quotes");
	});
});

describe("findMarkdownAnchorTarget", () => {
	it("should find heading ids and named anchors", () => {
		document.body.innerHTML = `
			<div id="markdown-root">
				<h2 id="overview">Overview</h2>
				<a name="custom-anchor"></a>
			</div>
		`;

		expect(findMarkdownAnchorTarget(document, "#overview")).toBe(
			document.getElementById("overview"),
		);
		expect(findMarkdownAnchorTarget(document, "#custom-anchor")).toBe(
			document.querySelector('a[name="custom-anchor"]'),
		);
	});
});
