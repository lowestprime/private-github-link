import { ListTree, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MarkdownHeading } from "@/lib/markdown-outline";
import { cn } from "@/lib/utils";

interface MarkdownOutlineProps {
	activeHeadingId?: string;
	className?: string;
	headings: MarkdownHeading[];
	onNavigate: (id: string) => void;
	onQueryChange: (value: string) => void;
	query: string;
}

export function MarkdownOutline({
	activeHeadingId,
	className,
	headings,
	onNavigate,
	onQueryChange,
	query,
}: MarkdownOutlineProps) {
	return (
		<div className={cn("flex h-full min-h-0 flex-col", className)}>
			<div className="flex items-center gap-2 px-1 pb-3">
				<ListTree className="size-4 text-muted-foreground" />
				<div>
					<p className="text-sm font-semibold">Outline</p>
					<p className="text-xs text-muted-foreground">
						{headings.length} heading{headings.length === 1 ? "" : "s"}
					</p>
				</div>
			</div>
			<div className="relative px-1 pb-3">
				<Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-[calc(50%+0.375rem)] text-muted-foreground" />
				<Input
					aria-label="Search headings"
					className="pl-8"
					placeholder="Search headings"
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
				/>
			</div>
			<ScrollArea className="min-h-0 flex-1 pr-1">
				<nav aria-label="Table of contents" className="space-y-1 px-1 pb-1">
					{headings.length === 0 ? (
						<p className="rounded-md px-3 py-2 text-sm text-muted-foreground">
							No headings match your search.
						</p>
					) : (
						headings.map((heading) => {
							const isActive = heading.id === activeHeadingId;

							return (
								<button
									aria-current={isActive ? "location" : undefined}
									className={cn(
										"w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
										isActive && "bg-accent text-accent-foreground",
									)}
									key={heading.id}
									onClick={() => onNavigate(heading.id)}
									style={{ paddingLeft: `${0.75 + (heading.depth - 1) * 0.75}rem` }}
									type="button"
								>
									<span className="block truncate">{heading.text}</span>
								</button>
							);
						})
					)}
				</nav>
			</ScrollArea>
		</div>
	);
}
