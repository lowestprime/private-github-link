import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileContent } from "@/lib/types/github";
import { MarkdownViewer } from "./markdown-viewer";

const mocks = vi.hoisted(() => ({
	highlightCodeFence: vi.fn(),
	mermaidInitialize: vi.fn(),
	mermaidRender: vi.fn(),
}));

vi.mock("mermaid", () => ({
	default: {
		initialize: mocks.mermaidInitialize,
		render: mocks.mermaidRender,
	},
}));

vi.mock("@/lib/github-code-highlighter", () => ({
	highlightCodeFence: mocks.highlightCodeFence,
}));

vi.mock("./stl-block", () => ({
	StlBlock: ({ source }: { source: string }) => (
		<div data-testid="stl-block">{source}</div>
	),
}));

const createMockFile = (overrides: Partial<FileContent> = {}): FileContent => ({
	name: "README.md",
	path: "README.md",
	sha: "abc123",
	size: 100,
	content: Buffer.from("# Hello World").toString("base64"),
	encoding: "base64",
	html_url: "https://github.com/owner/repo/blob/main/README.md",
	download_url: "https://raw.githubusercontent.com/owner/repo/main/README.md",
	...overrides,
});

describe("MarkdownViewer", () => {
	const defaultProps = {
		owner: "test-owner",
		repo: "test-repo",
		branch: "main",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mermaidRender.mockResolvedValue({
			bindFunctions: vi.fn(),
			svg: '<svg data-testid="mermaid-svg"></svg>',
		});
		mocks.highlightCodeFence.mockImplementation(
			async (code: string, flag?: string) => {
				if (!flag) {
					return null;
				}

				return {
					type: "root",
					children: [
						{
							type: "element",
							tagName: "span",
							properties: { className: ["pl-k"] },
							children: [{ type: "text", value: code }],
						},
					],
				};
			},
		);
	});

	it("should render heading from markdown", () => {
		const file = createMockFile({
			content: Buffer.from("# Hello World").toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"Hello World",
		);
	});

	it("should render GitHub-style heading ids and section links", () => {
		const file = createMockFile({
			content: Buffer.from("# Hello World\n## Hello World", "utf8").toString(
				"base64",
			),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		const headings = screen.getAllByRole("heading");
		expect(headings[0]).toHaveAttribute("id", "hello-world");
		expect(headings[1]).toHaveAttribute("id", "hello-world-1");

		const sectionLinks = screen.getAllByRole("link", {
			name: /Link to section:/,
		});
		expect(sectionLinks[0]).toHaveAttribute(
			"href",
			"/test-owner/test-repo/blob/main/README.md#hello-world",
		);
		expect(sectionLinks[1]).toHaveAttribute(
			"href",
			"/test-owner/test-repo/blob/main/README.md#hello-world-1",
		);
	});

	it("should route repo-relative links through the markdown navigation callback", () => {
		const onNavigateToMarkdownTarget = vi.fn();
		const file = createMockFile({
			path: "docs/README.md",
			content: Buffer.from("[Guide](../GUIDE.md#intro)", "utf8").toString(
				"base64",
			),
		});

		render(
			<MarkdownViewer
				file={file}
				onNavigateToMarkdownTarget={onNavigateToMarkdownTarget}
				{...defaultProps}
			/>,
		);

		const link = screen.getByRole("link", { name: "Guide" });
		expect(link).toHaveAttribute(
			"href",
			"/test-owner/test-repo/blob/main/GUIDE.md#intro",
		);

		fireEvent.click(link);

		expect(onNavigateToMarkdownTarget).toHaveBeenCalledWith({
			hash: "intro",
			path: "GUIDE.md",
		});
	});

	it("should render multiple heading levels", () => {
		const file = createMockFile({
			content: Buffer.from("# H1\n## H2\n### H3").toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("H1");
		expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("H2");
		expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("H3");
	});

	it("should render paragraphs", () => {
		const file = createMockFile({
			content: Buffer.from("This is a paragraph.\n\nThis is another.").toString(
				"base64",
			),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		expect(screen.getByText("This is a paragraph.")).toBeInTheDocument();
		expect(screen.getByText("This is another.")).toBeInTheDocument();
	});

	it("should render links with rel attribute", () => {
		const file = createMockFile({
			content: Buffer.from("[Link](https://example.com)").toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		const link = screen.getByRole("link", { name: "Link" });
		expect(link).toHaveAttribute("href", "https://example.com");
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("should render unordered lists", () => {
		const file = createMockFile({
			content: Buffer.from("- Item 1\n- Item 2\n- Item 3").toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		expect(screen.getByText("Item 1")).toBeInTheDocument();
		expect(screen.getByText("Item 2")).toBeInTheDocument();
		expect(screen.getByText("Item 3")).toBeInTheDocument();
	});

	it("should render ordered lists", () => {
		const file = createMockFile({
			content: Buffer.from("1. First\n2. Second\n3. Third").toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		expect(screen.getByText("First")).toBeInTheDocument();
		expect(screen.getByText("Second")).toBeInTheDocument();
		expect(screen.getByText("Third")).toBeInTheDocument();
	});

	it("should render code blocks", async () => {
		const file = createMockFile({
			content: Buffer.from("```js\nconst x = 1;\n```").toString("base64"),
		});

		const { container } = render(
			<MarkdownViewer file={file} {...defaultProps} />,
		);

		expect(screen.getByText(/const x = 1/)).toBeInTheDocument();

		await waitFor(() => {
			expect(container.querySelector(".pl-k")).toBeInTheDocument();
		});
	});

	it("should render inline code", () => {
		const file = createMockFile({
			content: Buffer.from("Use `npm install` to install.").toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		const inlineCode = screen.getByText("npm install");
		expect(inlineCode.tagName).toBe("CODE");
	});

	it("should preserve UTF-8 punctuation and smart quotes", () => {
		const text = "He said “Hello”—wasn’t it nice?";
		const file = createMockFile({
			content: Buffer.from(text, "utf8").toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		expect(screen.getByText(text)).toBeInTheDocument();
	});

	it("should render bold text", () => {
		const file = createMockFile({
			content: Buffer.from("This is **bold** text.").toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		const bold = screen.getByText("bold");
		expect(bold.tagName).toBe("STRONG");
	});

	it("should render italic text", () => {
		const file = createMockFile({
			content: Buffer.from("This is *italic* text.").toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		const italic = screen.getByText("italic");
		expect(italic.tagName).toBe("EM");
	});

	it("should render images with resolved relative URLs", () => {
		const file = createMockFile({
			path: "docs/README.md",
			content: Buffer.from("![Alt text](./image.png)").toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		const img = screen.getByRole("img", { name: "Alt text" });
		expect(img).toBeInTheDocument();
		expect(img.getAttribute("src")).toContain("githubusercontent.com");
	});

	it("should render absolute image URLs as-is", () => {
		const file = createMockFile({
			content: Buffer.from("![Logo](https://example.com/logo.png)").toString(
				"base64",
			),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		const img = screen.getByRole("img", { name: "Logo" });
		expect(img).toHaveAttribute("src", "https://example.com/logo.png");
	});

	it("should render GFM tables", () => {
		const file = createMockFile({
			content: Buffer.from(
				"| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1 | Cell 2 |",
			).toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		expect(screen.getByText("Header 1")).toBeInTheDocument();
		expect(screen.getByText("Cell 1")).toBeInTheDocument();
	});

	it("should render GFM strikethrough", () => {
		const file = createMockFile({
			content: Buffer.from("~~strikethrough~~").toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		const strikethrough = screen.getByText("strikethrough");
		expect(strikethrough.tagName).toBe("DEL");
	});

	it("should render Mermaid fenced code blocks", async () => {
		const chart = "graph TD\nA[Start] --> B[Done]";
		const file = createMockFile({
			content: Buffer.from(`\`\`\`mermaid\n${chart}\n\`\`\``, "utf8").toString(
				"base64",
			),
		});

		const { container } = render(
			<MarkdownViewer file={file} {...defaultProps} />,
		);

		await waitFor(() => {
			expect(
				container.querySelector('[data-testid="mermaid-svg"]'),
			).toBeInTheDocument();
		});

		expect(mocks.mermaidInitialize).toHaveBeenCalledWith(
			expect.objectContaining({
				securityLevel: "strict",
				startOnLoad: false,
			}),
		);
		expect(mocks.mermaidRender).toHaveBeenCalledWith(
			expect.stringMatching(/^mermaid-/),
			chart,
		);
	});

	it("should fall back to source text when Mermaid rendering fails", async () => {
		mocks.mermaidRender.mockRejectedValueOnce(new Error("Invalid diagram"));

		const file = createMockFile({
			content: Buffer.from(
				"```mermaid\ngraph TD\nA[Start] -->\n```",
				"utf8",
			).toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		expect(
			await screen.findByText(/Mermaid render failed:/),
		).toBeInTheDocument();
		expect(screen.getByText(/graph TD/)).toBeInTheDocument();
	});

	it("should render GeoJSON fenced code blocks as maps", async () => {
		const file = createMockFile({
			content: Buffer.from(
				'```geojson\n{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-90,35],[-90,30],[-85,30],[-85,35],[-90,35]]]},"properties":{}}]}\n```',
				"utf8",
			).toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByTestId("geojson-block")).toBeInTheDocument();
		});
	});

	it("should render TopoJSON fenced code blocks as maps", async () => {
		const topology = JSON.stringify({
			type: "Topology",
			transform: {
				scale: [0.0005000500050005, 0.00010001000100010001],
				translate: [100, 0],
			},
			objects: {
				example: {
					type: "GeometryCollection",
					geometries: [
						{
							type: "Polygon",
							properties: { prop0: "value0" },
							arcs: [[0]],
						},
					],
				},
			},
			arcs: [
				[
					[0, 0],
					[0, 9999],
					[2000, 0],
					[0, -9999],
					[-2000, 0],
				],
			],
		});
		const file = createMockFile({
			content: Buffer.from(
				`\`\`\`topojson\n${topology}\n\`\`\``,
				"utf8",
			).toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByTestId("topojson-block")).toBeInTheDocument();
		});
	});

	it("should render STL fenced code blocks with the STL viewer hook", () => {
		const file = createMockFile({
			content: Buffer.from(
				"```stl\nsolid shape\n  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n      vertex 1 0 0\n      vertex 0 1 0\n    endloop\n  endfacet\nendsolid\n```",
				"utf8",
			).toString("base64"),
		});

		render(<MarkdownViewer file={file} {...defaultProps} />);

		expect(screen.getByTestId("stl-block")).toBeInTheDocument();
	});

	it("should have prose styling classes", () => {
		const file = createMockFile();

		const { container } = render(
			<MarkdownViewer file={file} {...defaultProps} />,
		);

		const proseDiv = container.querySelector(".prose");
		expect(proseDiv).toBeInTheDocument();
	});
});
