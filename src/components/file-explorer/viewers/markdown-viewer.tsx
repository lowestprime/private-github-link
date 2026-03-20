import { LinkIcon } from "lucide-react";
import * as React from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
	decodeContent,
	resolveMarkdownLink,
	resolveRelativeUrl,
	type ResolvedMarkdownLink,
} from "@/lib/file-utils";
import {
	normalizeMarkdownHash,
	remarkGitHubHeadingIds,
	scrollMarkdownAnchorIntoView,
} from "@/lib/markdown-outline";
import type { FileContent } from "@/lib/types/github";
import { buildRepoPreviewHref, type ViewType } from "@/lib/route-utils";
import { cn } from "@/lib/utils";
import { GitHubCodeBlock } from "./github-code-block";
import { MapBlock } from "./map-block";
import { MermaidBlock } from "./mermaid-block";
import { StlBlock } from "./stl-block";

interface MarkdownViewerProps {
	accessToken?: string;
	branch: string;
	contentRef?: React.Ref<HTMLDivElement>;
	file: FileContent;
	onNavigateToMarkdownTarget?: (target: {
		hash?: string;
		path: string;
	}) => void;
	owner: string;
	repo: string;
	resolvePreviewViewType?: (path: string) => ViewType;
}

interface FenceData {
	code: string;
	flag?: string;
}

function extractFenceData(children: React.ReactNode): FenceData | null {
	const child = Array.isArray(children) ? children[0] : children;

	if (
		!React.isValidElement<{
			children?: React.ReactNode;
			className?: string;
		}>(child)
	) {
		return null;
	}

	const className = child.props.className || "";
	const languageClass = className
		.split(/\s+/)
		.find((token) => token.startsWith("language-"));

	return {
		code: String(child.props.children ?? "").replace(/\n$/, ""),
		flag: languageClass?.slice("language-".length),
	};
}

function renderFenceBlock({ code, flag }: FenceData) {
	const normalizedFlag = flag?.trim();
	const lowerFlag = normalizedFlag?.toLowerCase();

	if (lowerFlag === "mermaid") {
		return <MermaidBlock chart={code} />;
	}

	if (lowerFlag === "geojson" || lowerFlag === "topojson") {
		return <MapBlock format={lowerFlag} source={code} />;
	}

	if (lowerFlag === "stl") {
		return <StlBlock source={code} />;
	}

	return <GitHubCodeBlock code={code} language={normalizedFlag} />;
}

function getNodeText(children: React.ReactNode): string {
	return React.Children.toArray(children)
		.map((child) => {
			if (typeof child === "string" || typeof child === "number") {
				return String(child);
			}

			if (
				React.isValidElement<{
					children?: React.ReactNode;
				}>(child)
			) {
				return getNodeText(child.props.children);
			}

			return "";
		})
		.join("")
		.trim();
}

function shouldHandleClientNavigation(
	event: React.MouseEvent<HTMLAnchorElement>,
	target?: string,
): boolean {
	return !(
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.altKey ||
		event.ctrlKey ||
		event.shiftKey ||
		target === "_blank"
	);
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
	return (value: T | null) => {
		for (const ref of refs) {
			if (!ref) {
				continue;
			}

			if (typeof ref === "function") {
				ref(value);
				continue;
			}

			(ref as React.MutableRefObject<T | null>).current = value;
		}
	};
}

export function MarkdownViewer({
	accessToken,
	branch,
	contentRef,
	file,
	onNavigateToMarkdownTarget,
	owner,
	repo,
	resolvePreviewViewType,
}: MarkdownViewerProps) {
	const decodedContent = React.useMemo(
		() => decodeContent(file.content, file.encoding),
		[file.content, file.encoding],
	);
	const rootRef = React.useRef<HTMLDivElement>(null);
	const combinedContentRef = React.useMemo(
		() => mergeRefs(rootRef, contentRef),
		[contentRef],
	);

	const buildInternalHref = React.useCallback(
		(targetPath: string, hash?: string) => {
			const viewType = targetPath
				? (resolvePreviewViewType?.(targetPath) ?? "blob")
				: "tree";

			return buildRepoPreviewHref({
				accessToken,
				branch,
				hash,
				owner,
				path: targetPath,
				repo,
				viewType,
			});
		},
		[accessToken, branch, owner, repo, resolvePreviewViewType],
	);

	const scrollToCurrentHash = React.useCallback(() => {
		if (typeof window === "undefined") {
			return;
		}

		const root = rootRef.current;
		const hash = normalizeMarkdownHash(window.location.hash);

		if (!root || !hash) {
			return;
		}

		window.requestAnimationFrame(() => {
			scrollMarkdownAnchorIntoView(root, hash);
		});
	}, []);

	React.useEffect(() => {
		scrollToCurrentHash();
	}, [scrollToCurrentHash]);

	React.useEffect(() => {
		if (typeof window === "undefined") {
			return undefined;
		}

		const handleHashChange = () => {
			scrollToCurrentHash();
		};

		window.addEventListener("hashchange", handleHashChange);
		return () => window.removeEventListener("hashchange", handleHashChange);
	}, [scrollToCurrentHash]);

	const sanitizeSchema = React.useMemo(
		() => ({
			...defaultSchema,
			clobberPrefix: "",
			attributes: {
				...defaultSchema.attributes,
				a: [
					...(defaultSchema.attributes?.a || []),
					"href",
					"id",
					"name",
					"rel",
					"target",
					"title",
				],
				code: [...(defaultSchema.attributes?.code || []), "className"],
				div: [...(defaultSchema.attributes?.div || []), "className"],
				h1: [...(defaultSchema.attributes?.h1 || []), "id"],
				h2: [...(defaultSchema.attributes?.h2 || []), "id"],
				h3: [...(defaultSchema.attributes?.h3 || []), "id"],
				h4: [...(defaultSchema.attributes?.h4 || []), "id"],
				h5: [...(defaultSchema.attributes?.h5 || []), "id"],
				h6: [...(defaultSchema.attributes?.h6 || []), "id"],
				img: [
					...(defaultSchema.attributes?.img || []),
					"alt",
					"height",
					"src",
					"title",
					"width",
				],
				pre: [...(defaultSchema.attributes?.pre || []), "className"],
				span: [...(defaultSchema.attributes?.span || []), "className"],
			},
			tagNames: [
				...(defaultSchema.tagNames || []),
				"details",
				"img",
				"summary",
			],
		}),
		[],
	);

	const createHeadingComponent = React.useCallback(
		(level: 1 | 2 | 3 | 4 | 5 | 6) => {
			const Heading = ({
				children,
				className,
				id,
				...props
			}: React.ComponentPropsWithoutRef<`h${typeof level}`>) => {
				const headingId = typeof id === "string" ? id : undefined;
				const headingText = getNodeText(children);
				const sectionHref = headingId
					? buildInternalHref(file.path, headingId)
					: undefined;
				const Tag = `h${level}` as const;

				return (
					<Tag
						{...props}
						className={cn(
							"group/markdown-heading relative scroll-mt-28",
							className,
						)}
						data-markdown-heading-id={headingId}
						id={headingId}
					>
						{sectionHref && (
							<a
								aria-label={`Link to section: ${headingText}`}
								className="absolute top-1/2 right-full mr-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground opacity-0 transition hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring group-hover/markdown-heading:opacity-100"
								href={sectionHref}
								onClick={(event) => {
									if (
										!headingId ||
										!onNavigateToMarkdownTarget ||
										!shouldHandleClientNavigation(event)
									) {
										return;
									}

									event.preventDefault();
									onNavigateToMarkdownTarget({
										hash: headingId,
										path: file.path,
									});
								}}
							>
								<LinkIcon className="size-4" />
							</a>
						)}
						{children}
					</Tag>
				);
			};

			Heading.displayName = `MarkdownHeading${level}`;
			return Heading;
		},
		[buildInternalHref, file.path, onNavigateToMarkdownTarget],
	);

	const headingComponents = React.useMemo(
		() => ({
			h1: createHeadingComponent(1),
			h2: createHeadingComponent(2),
			h3: createHeadingComponent(3),
			h4: createHeadingComponent(4),
			h5: createHeadingComponent(5),
			h6: createHeadingComponent(6),
		}),
		[createHeadingComponent],
	);

	const handleMarkdownLinkClick = React.useCallback(
		(
			event: React.MouseEvent<HTMLAnchorElement>,
			targetLink: ResolvedMarkdownLink,
			targetWindow?: string,
		) => {
			if (
				!onNavigateToMarkdownTarget ||
				!shouldHandleClientNavigation(event, targetWindow)
			) {
				return;
			}

			event.preventDefault();
			onNavigateToMarkdownTarget({
				hash: targetLink.hash || undefined,
				path: targetLink.path,
			});
		},
		[onNavigateToMarkdownTarget],
	);

	return (
		<div
			className="prose prose-sm dark:prose-invert max-w-none px-6 py-4"
			data-markdown-preview="true"
			ref={combinedContentRef}
		>
			<Markdown
				components={{
					...headingComponents,
					a({ href, onClick, rel, target, ...props }) {
						const resolvedLink = href
							? resolveMarkdownLink(href, file.path)
							: null;

						if (!resolvedLink) {
							return (
								<a
									{...props}
									href={href}
									onClick={onClick}
									rel={rel ?? "noopener noreferrer"}
									target={target}
								/>
							);
						}

						const internalHref = buildInternalHref(
							resolvedLink.path,
							resolvedLink.hash || undefined,
						);

						return (
							<a
								{...props}
								href={internalHref}
								onClick={(event) => {
									onClick?.(event);
									handleMarkdownLinkClick(event, resolvedLink, target);
								}}
								target={target}
							/>
						);
					},
					img({ alt, src, ...props }) {
						const resolvedSrc = src
							? resolveRelativeUrl(src, file.path, owner, repo, branch)
							: "";

						return <img alt={alt || ""} src={resolvedSrc} {...props} />;
					},
					pre({ children, ...props }) {
						const fenceData = extractFenceData(children);

						if (fenceData) {
							return renderFenceBlock(fenceData);
						}

						return <pre {...props}>{children}</pre>;
					},
				}}
				rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
				remarkPlugins={[remarkGfm, remarkGitHubHeadingIds]}
			>
				{decodedContent}
			</Markdown>
		</div>
	);
}

