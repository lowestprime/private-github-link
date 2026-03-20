import type { Heading, Root } from "mdast";
import { toString as markdownNodeToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export interface MarkdownHeading {
	depth: number;
	id: string;
	text: string;
}

const ALLOWED_SLUG_CHARACTER = /[\p{Letter}\p{Number}\p{Mark}-]/u;
const WHITESPACE_CHARACTER = /\s/u;

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function createBaseHeadingSlug(value: string): string {
	const normalizedValue = value.trim().toLowerCase().normalize("NFKC");
	let slug = "";
	let previousWasHyphen = false;

	for (const character of normalizedValue) {
		if (WHITESPACE_CHARACTER.test(character)) {
			if (slug && !previousWasHyphen) {
				slug += "-";
				previousWasHyphen = true;
			}
			continue;
		}

		if (ALLOWED_SLUG_CHARACTER.test(character)) {
			slug += character;
			previousWasHyphen = character === "-";
		}
	}

	const trimmedSlug = slug.replace(/^-+|-+$/g, "");
	return trimmedSlug || "section";
}

class GitHubHeadingSlugger {
	private readonly occurrences = new Map<string, number>();

	slug(value: string): string {
		const baseSlug = createBaseHeadingSlug(value);
		const duplicateCount = this.occurrences.get(baseSlug) ?? 0;

		this.occurrences.set(baseSlug, duplicateCount + 1);

		return duplicateCount === 0 ? baseSlug : `${baseSlug}-${duplicateCount}`;
	}
}

function parseMarkdownTree(markdown: string): Root {
	return unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root;
}

function visitHeadings(
	tree: Root,
	visitor: (node: Heading, text: string) => void,
): void {
	visit(tree, "heading", (node) => {
		const headingNode = node as Heading;
		const text = markdownNodeToString(headingNode).trim();

		if (!text) {
			return;
		}

		visitor(headingNode, text);
	});
}

export function normalizeMarkdownHash(hash: string): string {
	return safeDecodeURIComponent(hash.replace(/^#/, ""));
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
	try {
		const tree = parseMarkdownTree(markdown);
		const slugger = new GitHubHeadingSlugger();
		const headings: MarkdownHeading[] = [];

		visitHeadings(tree, (node, text) => {
			headings.push({
				depth: node.depth,
				id: slugger.slug(text),
				text,
			});
		});

		return headings;
	} catch {
		return [];
	}
}

export function remarkGitHubHeadingIds() {
	return (tree: Root) => {
		const slugger = new GitHubHeadingSlugger();

		visitHeadings(tree, (node, text) => {
			const id = slugger.slug(text);
			const data = node.data ?? {};
			node.data = data;
			const existingProperties =
				typeof data.hProperties === "object" && data.hProperties !== null
					? (data.hProperties as Record<string, unknown>)
					: {};

			data.hProperties = {
				...existingProperties,
				id,
			};
		});
	};
}

export function findMarkdownAnchorTarget(
	root: ParentNode,
	hash: string,
): HTMLElement | null {
	const normalizedHash = normalizeMarkdownHash(hash);

	if (!normalizedHash) {
		return null;
	}

	if ("getElementById" in root && typeof root.getElementById === "function") {
		const idMatch = root.getElementById(normalizedHash);
		if (idMatch instanceof HTMLElement) {
			return idMatch;
		}
	}

	if (
		root instanceof Document ||
		root instanceof DocumentFragment ||
		root instanceof HTMLElement
	) {
		const nameMatch = Array.from(root.querySelectorAll("a[name]")).find(
			(anchor) => anchor.getAttribute("name") === normalizedHash,
		);

		return (nameMatch as HTMLElement | undefined) ?? null;
	}

	return null;
}

export function scrollMarkdownAnchorIntoView(
	root: ParentNode,
	hash: string,
	behavior: ScrollBehavior = "auto",
): boolean {
	const target = findMarkdownAnchorTarget(root, hash);

	if (!target) {
		return false;
	}

	target.scrollIntoView({
		behavior,
		block: "start",
	});

	return true;
}
