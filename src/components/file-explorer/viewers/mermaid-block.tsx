import * as React from "react";

interface MermaidBlockProps {
	chart: string;
}

function getMermaidTheme(): "default" | "dark" {
	if (typeof document === "undefined") {
		return "default";
	}

	return document.documentElement.classList.contains("dark")
		? "dark"
		: "default";
}

export function MermaidBlock({ chart }: MermaidBlockProps) {
	const chartSource = React.useMemo(() => chart.trim(), [chart]);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const renderId = React.useId().replace(/:/g, "-");
	const [error, setError] = React.useState<string | null>(null);
	const [theme, setTheme] = React.useState<"default" | "dark">("default");

	React.useEffect(() => {
		if (typeof document === "undefined") {
			return;
		}

		const root = document.documentElement;
		const updateTheme = () => setTheme(getMermaidTheme());

		updateTheme();

		const observer = new MutationObserver(updateTheme);
		observer.observe(root, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	React.useEffect(() => {
		let cancelled = false;

		async function renderDiagram() {
			try {
				const mermaid = (await import("mermaid")).default;

				mermaid.initialize({
					startOnLoad: false,
					securityLevel: "strict",
					theme,
				});

				const { svg, bindFunctions } = await mermaid.render(
					`mermaid-${renderId}`,
					chartSource,
				);

				if (cancelled || !containerRef.current) {
					return;
				}

				containerRef.current.innerHTML = svg;
				bindFunctions?.(containerRef.current);
				setError(null);
			} catch (err) {
				if (cancelled) {
					return;
				}

				if (containerRef.current) {
					containerRef.current.innerHTML = "";
				}

				setError(
					err instanceof Error
						? err.message
						: "Failed to render Mermaid diagram.",
				);
			}
		}

		void renderDiagram();

		return () => {
			cancelled = true;
		};
	}, [chartSource, renderId, theme]);

	if (error) {
		return (
			<div className="not-prose my-4 overflow-x-auto rounded-lg border bg-muted/20 p-4">
				<pre className="overflow-x-auto whitespace-pre-wrap text-sm">
					<code>{chartSource}</code>
				</pre>
				<p className="mt-3 text-sm text-destructive">
					Mermaid render failed: {error}
				</p>
			</div>
		);
	}

	return (
		<div className="not-prose my-4 overflow-x-auto rounded-lg border bg-muted/20 p-4">
			<div
				ref={containerRef}
				className="[&_svg]:h-auto [&_svg]:max-w-full"
				data-testid="mermaid-block"
			/>
		</div>
	);
}
