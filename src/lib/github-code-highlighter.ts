import onigurumaUrl from "vscode-oniguruma/release/onig.wasm?url";

export type HighlightContentNode = HighlightElementNode | HighlightTextNode;

export interface HighlightElementNode {
	type: "element";
	tagName: string;
	properties?: {
		className?: string[];
	};
	children?: HighlightContentNode[];
}

export interface HighlightRootNode {
	type: "root";
	children: HighlightContentNode[];
}

export interface HighlightTextNode {
	type: "text";
	value: string;
}

interface StarryNightLike {
	flagToScope(flag: string): string | undefined;
	highlight(value: string, scope: string): unknown;
}

let starryNightPromise: Promise<StarryNightLike> | undefined;

async function getStarryNight(): Promise<StarryNightLike> {
	if (!starryNightPromise) {
		starryNightPromise = (async () => {
			const { all, createStarryNight } = await import("@wooorm/starry-night");
			return (await createStarryNight(all, {
				getOnigurumaUrlFetch() {
					return new URL(onigurumaUrl, window.location.href);
				},
			})) as unknown as StarryNightLike;
		})();
	}

	return starryNightPromise;
}

export async function highlightCodeFence(
	code: string,
	flag?: string,
): Promise<HighlightRootNode | null> {
	if (typeof window === "undefined") {
		return null;
	}

	const normalizedFlag = flag?.trim();
	if (!normalizedFlag) {
		return null;
	}

	const starryNight = await getStarryNight();
	const scope = starryNight.flagToScope(normalizedFlag);

	if (!scope) {
		return null;
	}

	return starryNight.highlight(code, scope) as HighlightRootNode;
}
