import {
	Check,
	Copy,
	Download,
	History,
	LinkIcon,
	ListTree,
	MoreHorizontal,
	PanelLeft,
	WrapText,
	X,
} from "lucide-react";
import * as React from "react";
import { MarkdownOutline } from "@/components/file-explorer/viewers/markdown-outline";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_DOMAIN } from "@/lib/constants";
import {
	countLines,
	decodeContent,
	downloadFile,
	getFileType,
} from "@/lib/file-utils";
import {
	extractMarkdownHeadings,
	findMarkdownAnchorTarget,
	normalizeMarkdownHash,
} from "@/lib/markdown-outline";
import { formatDate, formatFileSize } from "@/lib/format";
import type {
	CommitHistoryData,
	CommitInfo,
	DirectoryContent,
	FileContent,
} from "@/lib/types/github";
import type { ViewType } from "@/lib/route-utils";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Breadcrumb } from "./breadcrumb";
import { CommitHistoryView } from "./commit-history-view";
import { DirectoryViewer } from "./directory-viewer";
import {
	AudioViewer,
	BinaryFileViewer,
	CodeViewer,
	ImageViewer,
	MarkdownViewer,
	PdfViewer,
	VideoViewer,
} from "./viewers";

interface FileViewerProps {
	accessToken?: string;
	branch?: string;
	className?: string;
	commit?: CommitInfo;
	commitHistory?: CommitHistoryData | null;
	directory?: DirectoryContent | null;
	error?: string | null;
	file: FileContent | null;
	historyPage?: number;
	isHistoryLoading?: boolean;
	isLoading?: boolean;
	onCloseHistory?: () => void;
	onFileSelect?: (path: string) => void;
	onHover?: (path: string, type: "tree" | "blob") => void;
	onMarkdownNavigate?: (target: { hash?: string; path: string }) => void;
	onNavigate?: (path: string) => void;
	onNextPage?: () => void;
	onPrevPage?: () => void;
	onShowHistory?: () => void;
	onToggleMobileExplorer?: () => void;
	owner?: string;
	currentPath?: string;
	repoName?: string;
	resolvePreviewViewType?: (path: string) => ViewType;
	showHistory?: boolean;
	totalCommits?: number;
}

/**
 * Content renderer that switches based on file type
 */
function FileContentRenderer({
	accessToken,
	branch,
	contentRef,
	file,
	onMarkdownNavigate,
	owner,
	repo,
	resolvePreviewViewType,
	showPreview = true,
	wrapText = false,
}: {
	accessToken?: string;
	branch: string;
	contentRef?: React.Ref<HTMLDivElement>;
	file: FileContent;
	onMarkdownNavigate?: (target: { hash?: string; path: string }) => void;
	owner: string;
	repo: string;
	resolvePreviewViewType?: (path: string) => ViewType;
	showPreview?: boolean;
	wrapText?: boolean;
}) {
	const fileType = getFileType(file.name);

	switch (fileType) {
		case "image":
			return <ImageViewer file={file} />;
		case "pdf":
			return <PdfViewer file={file} />;
		case "video":
			return <VideoViewer file={file} />;
		case "audio":
			return <AudioViewer file={file} />;
		case "binary":
			return <BinaryFileViewer file={file} />;
		case "markdown":
			return showPreview ? (
				<MarkdownViewer
					accessToken={accessToken}
					branch={branch}
					contentRef={contentRef}
					file={file}
					onNavigateToMarkdownTarget={onMarkdownNavigate}
					owner={owner}
					repo={repo}
					resolvePreviewViewType={resolvePreviewViewType}
				/>
			) : (
				<CodeViewer file={file} wrapText={wrapText} />
			);
		default:
			return <CodeViewer file={file} wrapText={wrapText} />;
	}
}

export function FileViewer({
	accessToken,
	branch = "main",
	className,
	commit,
	commitHistory,
	directory,
	error,
	file,
	historyPage = 1,
	isHistoryLoading,
	isLoading,
	onCloseHistory,
	onFileSelect,
	onHover,
	onMarkdownNavigate,
	onNavigate,
	onNextPage,
	onPrevPage,
	onShowHistory,
	onToggleMobileExplorer,
	owner = "",
	currentPath: propCurrentPath,
	repoName = "repository",
	resolvePreviewViewType,
	showHistory = false,
	totalCommits,
}: FileViewerProps) {
	const [activeHeadingId, setActiveHeadingId] = React.useState("");
	const [outlineOpen, setOutlineOpen] = React.useState(false);
	const [outlineQuery, setOutlineQuery] = React.useState("");
	const [wrapText, setWrapText] = React.useState(false);
	const [showMarkdownPreview, setShowMarkdownPreview] = React.useState(true);
	const deferredOutlineQuery = React.useDeferredValue(outlineQuery);
	const markdownContentRef = React.useRef<HTMLDivElement>(null);

	// Determine if we're showing a directory or file
	const isDirectoryView = !file && directory;
	const currentPath = propCurrentPath ?? file?.path ?? directory?.path ?? "";
	const isRoot = !currentPath;


	const fileType = file ? getFileType(file.name) : null;
	const isTextFile = fileType === "text";
	const isMarkdown = fileType === "markdown";
	const isTextBased = isTextFile || isMarkdown;

	// Only compute line info for text-based files
	const decodedContent =
		isTextBased && file ? decodeContent(file.content, file.encoding) : "";
	const lineCount = isTextBased ? decodedContent.split("\n").length : 0;
	const markdownHeadings = React.useMemo(
		() =>
			isMarkdown && showMarkdownPreview
				? extractMarkdownHeadings(decodedContent)
				: [],
		[decodedContent, isMarkdown, showMarkdownPreview],
	);
	const showMarkdownOutline =
		isMarkdown && showMarkdownPreview && markdownHeadings.length >= 2;
	const filteredMarkdownHeadings = React.useMemo(() => {
		const normalizedQuery = deferredOutlineQuery.trim().toLowerCase();

		if (!normalizedQuery) {
			return markdownHeadings;
		}

		return markdownHeadings.filter((heading) =>
			heading.text.toLowerCase().includes(normalizedQuery),
		);
	}, [deferredOutlineQuery, markdownHeadings]);

	// Get the display commit (from file or directory)
	const displayCommit = commit || directory?.commit;

	React.useEffect(() => {
		void currentPath;
		void showMarkdownPreview;
		setOutlineOpen(false);
		setOutlineQuery("");
	}, [currentPath, showMarkdownPreview]);

	React.useEffect(() => {
		if (!showMarkdownOutline || typeof window === "undefined") {
			setActiveHeadingId("");
			return undefined;
		}

		const root = markdownContentRef.current;
		if (!root) {
			return undefined;
		}

		const headingTargets = markdownHeadings
			.map((heading) => ({
				element: findMarkdownAnchorTarget(root, heading.id),
				id: heading.id,
			}))
			.filter(
				(
					target,
				): target is {
					element: HTMLElement;
					id: string;
				} => target.element instanceof HTMLElement,
			);

		if (headingTargets.length === 0) {
			return undefined;
		}

		const updateActiveHeading = () => {
			const currentHash = normalizeMarkdownHash(window.location.hash);
			let nextHeadingId = currentHash || headingTargets[0]?.id || "";

			for (const headingTarget of headingTargets) {
				if (headingTarget.element.getBoundingClientRect().top <= 160) {
					nextHeadingId = headingTarget.id;
				}
			}

			setActiveHeadingId(nextHeadingId);
		};

		const handleViewportChange = () => {
			window.requestAnimationFrame(updateActiveHeading);
		};

		updateActiveHeading();
		window.addEventListener("scroll", handleViewportChange, { passive: true });
		window.addEventListener("resize", handleViewportChange);
		window.addEventListener("hashchange", handleViewportChange);

		return () => {
			window.removeEventListener("scroll", handleViewportChange);
			window.removeEventListener("resize", handleViewportChange);
			window.removeEventListener("hashchange", handleViewportChange);
		};
	}, [markdownHeadings, showMarkdownOutline]);

	const handleOutlineNavigate = React.useCallback(
		(id: string) => {
			if (onMarkdownNavigate) {
				onMarkdownNavigate({
					hash: id,
					path: currentPath,
				});
			} else if (typeof window !== "undefined") {
				const nextUrl = new URL(window.location.href);
				nextUrl.hash = encodeURIComponent(id);
				window.history.pushState({}, "", nextUrl);
				if (markdownContentRef.current) {
					findMarkdownAnchorTarget(markdownContentRef.current, id)?.scrollIntoView({
						behavior: "auto",
						block: "start",
					});
				}
			}

			setOutlineOpen(false);
		},
		[currentPath, onMarkdownNavigate],
	);

	// If showing history, render the history view instead (check before file/directory check)
	if (showHistory) {
		return (
			<div
				data-slot="file-viewer"
				className={cn("border rounded-lg bg-background", className)}
			>
				<CommitHistoryView
					history={commitHistory}
					path={currentPath}
					branch={branch}
					repoName={repoName}
					page={historyPage}
					isLoading={isHistoryLoading}
					onClose={onCloseHistory}
					onPrevPage={onPrevPage}
					onNextPage={onNextPage}
				/>
			</div>
		);
	}

	return (
		<div
			data-slot="file-viewer"
			className={cn("border rounded-lg bg-background", className)}
		>
			{/* Sticky header section - before pseudo-element covers the gap above */}
			<div className="sticky top-2 lg:top-4 z-20 bg-background rounded-t-lg before:absolute before:-left-px before:-right-px before:bottom-full before:h-2 lg:before:h-4 before:bg-muted">
				{/* Header with breadcrumb */}
				<div className="flex items-center justify-between px-4 py-3 border-b gap-2">
					{/* Mobile file explorer toggle - only visible on < lg */}
					{onToggleMobileExplorer && (
						<Button
							variant={"outline"}
							onClick={onToggleMobileExplorer}
							className="lg:hidden p-1.5 -ml-1.5 rounded-md text-muted-foreground shrink-0"
							aria-label="Open file explorer"
						>
							<PanelLeft className="size-4" />
						</Button>
					)}
					<Breadcrumb
						repoName={repoName}
						path={currentPath}
						onNavigate={onNavigate}
					/>
					<DropdownMenu>
						<DropdownMenuTrigger
							className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
							aria-label="More options"
						>
							<MoreHorizontal className="size-4" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							{file && (
								<>
									<DropdownMenuItem
										onClick={() => downloadFile(file)}
										disabled={isLoading}
									>
										<Download className="size-4" />
										<span>Download</span>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
								</>
							)}
							<DropdownMenuItem
								disabled={isLoading}
								onClick={() => {
									navigator.clipboard.writeText(currentPath);
								}}
							>
								<Copy className="size-4" />
								<span>Copy path</span>
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={isLoading}
								onClick={() => {
									const permalink = `${APP_DOMAIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
									navigator.clipboard.writeText(permalink);
								}}
							>
								<LinkIcon className="size-4" />
								<span>Copy permalink</span>
							</DropdownMenuItem>
							{file && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										disabled={isLoading}
										onClick={() => setWrapText(!wrapText)}
									>
										<WrapText className="size-4" />
										<span>Wrap lines</span>
										{wrapText && <Check className="size-4 ml-auto" />}
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Commit info */}
				{isLoading ? (
					<div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
						<Skeleton className="size-6 rounded-full shrink-0 bg-muted-foreground/20" />
						<div className="flex-1 min-w-0 flex items-center gap-2">
							<Skeleton className="h-4 w-20 bg-muted-foreground/20" />
							<Skeleton className="h-4 w-48 bg-muted-foreground/20" />
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<Skeleton className="h-4 w-14 bg-muted-foreground/20" />
							<Skeleton className="h-4 w-16 bg-muted-foreground/20" />
						</div>
					</div>
				) : displayCommit ? (
					<div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30">
						{displayCommit.authorUrl ? (
							<a
								href={displayCommit.authorUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="shrink-0"
							>
								{displayCommit.avatarUrl ? (
									<img
										src={displayCommit.avatarUrl}
										alt={displayCommit.author}
										className="size-6 rounded-full hover:opacity-80 transition-opacity"
									/>
								) : (
									<div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium hover:opacity-80 transition-opacity">
										{displayCommit.author.charAt(0).toUpperCase()}
									</div>
								)}
							</a>
						) : (
							<div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
								{displayCommit.author.charAt(0).toUpperCase()}
							</div>
						)}
						<div className="flex-1 min-w-0 flex items-center">
							<span className="font-medium text-sm shrink-0">
								{displayCommit.author}
							</span>
							<span className="text-muted-foreground text-sm ml-2 truncate">
								{displayCommit.message.split("\n")[0]}
							</span>
						</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
							<span className="font-mono">
								{displayCommit.sha.substring(0, 7)}
							</span>
							<span>·</span>
							<span>{formatDate(displayCommit.date)}</span>
							<Button
								className="flex items-center gap-1 ml-2 px-2 py-1 rounded-md border hover:bg-accent"
								onClick={onShowHistory}
							>
								<History className="size-3.5" />
								<span>
									{isRoot && totalCommits !== undefined
										? `${totalCommits.toLocaleString()} commits`
										: "History"}
								</span>
							</Button>
						</div>
					</div>
				) : null}

				{/* File toolbar - inside sticky header */}
				{file && (
					<div className="flex items-center justify-between px-4 py-2 border-b gap-3">
						<div className="flex items-center gap-1 flex-wrap">
							{isMarkdown ? (
								<>
									<Button
										disabled={isLoading}
										variant="ghost"
										size="sm"
										onClick={() => setShowMarkdownPreview(true)}
										className={cn(
											showMarkdownPreview && "bg-accent text-accent-foreground",
										)}
									>
										Preview
									</Button>
									<Button
										disabled={isLoading}
										variant="ghost"
										size="sm"
										onClick={() => setShowMarkdownPreview(false)}
										className={cn(
											!showMarkdownPreview &&
												"bg-accent text-accent-foreground",
										)}
									>
										Code
									</Button>
									{showMarkdownPreview && showMarkdownOutline && (
										<Button
											className={cn(
												"xl:hidden",
												outlineOpen && "bg-accent text-accent-foreground",
											)}
											disabled={isLoading}
											variant="ghost"
											size="sm"
											onClick={() => setOutlineOpen((open) => !open)}
										>
											<ListTree className="size-4" />
											<span>Outline</span>
										</Button>
									)}
									{!showMarkdownPreview && (
										<Button
											disabled={isLoading}
											variant="ghost"
											size="icon-sm"
											className={cn(wrapText && "bg-accent")}
											aria-label="Wrap Code"
											onClick={() => setWrapText(!wrapText)}
										>
											<WrapText className="size-4" />
										</Button>
									)}
								</>
							) : isTextFile ? (
								<>
									<div
										className={cn(
											"px-3 py-1.5 text-sm font-medium rounded-md",
											"bg-muted text-muted-foreground",
										)}
									>
										Code
									</div>

									<Button
										disabled={isLoading}
										variant="ghost"
										size="icon-sm"
										className={cn(wrapText && "bg-accent")}
										aria-label="Wrap Code"
										onClick={() => setWrapText(!wrapText)}
									>
										<WrapText className="size-4" />
									</Button>
								</>
							) : (
								<span className="px-3 py-1.5 text-sm font-medium text-muted-foreground">
									Preview
								</span>
							)}
						</div>

						<div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 flex-wrap justify-end">
							{isTextBased ? (
								<span>
									{lineCount} lines ({countLines(decodedContent)} loc) ·{" "}
									{formatFileSize(file.size)}
								</span>
							) : (
								<span>{formatFileSize(file.size)}</span>
							)}
							<div className="flex items-center gap-1 ml-0 sm:ml-4">
								{isTextBased && (
									<>
										<Button
											disabled={isLoading}
											variant="ghost"
											size="sm"
											aria-label="Open raw"
											onClick={() => window.open(file.download_url, "_blank")}
										>
											Raw
										</Button>
										<Button
											disabled={isLoading}
											variant="ghost"
											size="icon-sm"
											aria-label="Copy content"
											onClick={async () => {
												await navigator.clipboard.writeText(
													decodeContent(file.content, file.encoding),
												);
											}}
										>
											<Copy className="size-4" />
										</Button>
									</>
								)}
								<Button
									disabled={isLoading}
									variant="ghost"
									size="icon-sm"
									aria-label="Download"
									onClick={() => downloadFile(file)}
								>
									<Download className="size-4" />
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Content area */}
			{isLoading ? (
				<DirectorySkeleton />
			) : error ? (
				<div className="flex items-center justify-center py-16">
					<div className="text-center">
						<div className="text-destructive font-medium">Error loading</div>
						<div className="text-sm text-muted-foreground mt-1">{error}</div>
					</div>
				</div>
			) : isDirectoryView && directory ? (
				<DirectoryViewer
					directory={directory}
					onNavigate={onNavigate}
					onFileSelect={onFileSelect}
					onHover={onHover}
				/>
			) : file ? (
				<>
					{outlineOpen && showMarkdownOutline && (
						<>
							<Button
								type="button"
								className="fixed inset-0 z-30 h-auto bg-background/60 hover:bg-background/60 xl:hidden cursor-default"
								onClick={() => setOutlineOpen(false)}
								aria-label="Close outline"
							/>
							<div className="fixed inset-y-24 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-lg border bg-background p-3 shadow-2xl xl:hidden">
								<Button
									variant="ghost"
									size="icon-sm"
									className="absolute top-3 right-3"
									onClick={() => setOutlineOpen(false)}
									aria-label="Close outline"
								>
									<X className="size-4" />
								</Button>
								<MarkdownOutline
									activeHeadingId={activeHeadingId}
									headings={filteredMarkdownHeadings}
									onNavigate={handleOutlineNavigate}
									onQueryChange={setOutlineQuery}
									query={outlineQuery}
								/>
							</div>
						</>
					)}
					{showMarkdownOutline ? (
						<div className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem]">
							<div className="min-w-0">
								<FileContentRenderer
									accessToken={accessToken}
									branch={branch}
									contentRef={markdownContentRef}
									file={file}
									onMarkdownNavigate={onMarkdownNavigate}
									owner={owner}
									repo={repoName}
									resolvePreviewViewType={resolvePreviewViewType}
									showPreview={showMarkdownPreview}
									wrapText={wrapText}
								/>
							</div>
							<aside className="hidden border-l bg-muted/10 xl:block">
								<div className="sticky top-24 h-[calc(100vh-8rem)] p-4">
									<MarkdownOutline
										activeHeadingId={activeHeadingId}
										headings={filteredMarkdownHeadings}
										onNavigate={handleOutlineNavigate}
										onQueryChange={setOutlineQuery}
										query={outlineQuery}
									/>
								</div>
							</aside>
						</div>
					) : (
						<FileContentRenderer
							accessToken={accessToken}
							branch={branch}
							contentRef={markdownContentRef}
							file={file}
							onMarkdownNavigate={onMarkdownNavigate}
							owner={owner}
							repo={repoName}
							resolvePreviewViewType={resolvePreviewViewType}
							showPreview={showMarkdownPreview}
							wrapText={wrapText}
						/>
					)}
				</>
			) : null}
		</div>
	);
}

/**
 * Skeleton loader for directory view
 */
const SKELETON_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

function DirectorySkeleton() {
	return (
		<div className="w-full overflow-hidden">
			<table className="w-full table-fixed">
				<thead>
					<tr className="border-b text-left text-sm text-muted-foreground">
						<th className="px-4 py-2 font-medium w-1/3">Name</th>
						<th className="px-4 py-2 font-medium w-1/2">Last commit message</th>
						<th className="px-4 py-2 font-medium text-right w-1/6">
							Last commit date
						</th>
					</tr>
				</thead>
				<tbody>
					{SKELETON_ROWS.map((n) => (
						<tr key={`skeleton-${n}`} className="border-b">
							<td className="px-4 py-2">
								<div className="flex items-center gap-2">
									<Skeleton className="size-4 bg-muted-foreground/20" />
									<Skeleton className="h-6 w-24 bg-muted-foreground/20" />
								</div>
							</td>
							<td className="px-4 py-2">
								<Skeleton className="h-6 w-48 bg-muted-foreground/20" />
							</td>
							<td className="px-4 py-2 text-right">
								<Skeleton className="h-6 w-20 ml-auto bg-muted-foreground/20" />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}





