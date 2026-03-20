import * as React from "react";
import {
	highlightCodeFence,
	type HighlightContentNode,
	type HighlightRootNode,
} from "@/lib/github-code-highlighter";

interface GitHubCodeBlockProps {
	code: string;
	language?: string;
}

function renderHighlightNode(
	node: HighlightContentNode,
	key: React.Key,
): React.ReactNode {
	if (node.type === "text") {
		return node.value;
	}

	const className = node.properties?.className?.join(" ");

	return React.createElement(
		node.tagName,
		{
			className,
			key,
		},
		node.children?.map((child, index) =>
			renderHighlightNode(child, `${key}-${index}`),
		),
	);
}

function renderHighlightTree(tree: HighlightRootNode): React.ReactNode {
	return tree.children.map((child, index) => renderHighlightNode(child, index));
}

export function GitHubCodeBlock({ code, language }: GitHubCodeBlockProps) {
	const normalizedCode = React.useMemo(() => code.replace(/\n$/, ""), [code]);
	const [highlightedTree, setHighlightedTree] =
		React.useState<HighlightRootNode | null>(null);

	React.useEffect(() => {
		let cancelled = false;

		setHighlightedTree(null);

		if (!language) {
			return () => {
				cancelled = true;
			};
		}

		void highlightCodeFence(normalizedCode, language)
			.then((tree) => {
				if (!cancelled) {
					setHighlightedTree(tree);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setHighlightedTree(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [language, normalizedCode]);

	return (
		<div className="github-code-block not-prose my-4 overflow-hidden rounded-lg border bg-muted/30">
			<pre className="overflow-x-auto px-4 py-3 text-sm leading-6">
				<code
					className="github-code-content block min-w-full whitespace-pre"
					data-language={language || "plain"}
				>
					{highlightedTree
						? renderHighlightTree(highlightedTree)
						: normalizedCode}
				</code>
			</pre>
		</div>
	);
}
