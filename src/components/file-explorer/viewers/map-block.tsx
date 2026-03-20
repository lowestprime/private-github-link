import * as React from "react";
import type {
	Feature,
	FeatureCollection,
	GeoJsonObject,
	Geometry,
	GeometryCollection,
} from "geojson";
import type { Topology } from "topojson-specification";

interface MapBlockProps {
	format: "geojson" | "topojson";
	source: string;
}

interface RenderedPath {
	d: string;
	geometryType: Geometry["type"] | null;
	key: string;
}

const SVG_HEIGHT = 360;
const SVG_PADDING = 18;
const SVG_WIDTH = 640;

function geoJsonToFeatureCollection(
	value: GeoJsonObject,
): FeatureCollection<Geometry> {
	if (value.type === "FeatureCollection") {
		return value as FeatureCollection<Geometry>;
	}

	if (value.type === "Feature") {
		return {
			type: "FeatureCollection",
			features: [value as Feature<Geometry>],
		};
	}

	if (value.type === "GeometryCollection") {
		return {
			type: "FeatureCollection",
			features: (value as GeometryCollection).geometries.map(
				(geometry, index) => ({
					type: "Feature",
					geometry,
					id: index,
					properties: {},
				}),
			),
		};
	}

	return {
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				geometry: value as Geometry,
				properties: {},
			},
		],
	};
}

function isTopology(value: unknown): value is Topology {
	if (!value || typeof value !== "object") {
		return false;
	}

	return (
		"type" in value &&
		value.type === "Topology" &&
		"objects" in value &&
		typeof value.objects === "object"
	);
}

function pathPropsForGeometry(type: Geometry["type"] | null) {
	if (!type) {
		return {
			fill: "none",
			stroke: "var(--muted-foreground)",
			strokeWidth: 1.5,
		};
	}

	if (type.includes("Line")) {
		return {
			fill: "none",
			stroke: "var(--primary)",
			strokeWidth: 2,
		};
	}

	if (type.includes("Point")) {
		return {
			fill: "var(--accent)",
			fillOpacity: 0.9,
			stroke: "var(--background)",
			strokeWidth: 1.25,
		};
	}

	return {
		fill: "var(--primary)",
		fillOpacity: 0.18,
		stroke: "var(--primary)",
		strokeWidth: 1.6,
	};
}

export function MapBlock({ format, source }: MapBlockProps) {
	const normalizedSource = React.useMemo(() => source.trim(), [source]);
	const [error, setError] = React.useState<string | null>(null);
	const [paths, setPaths] = React.useState<RenderedPath[]>([]);

	React.useEffect(() => {
		let cancelled = false;

		async function renderMap() {
			try {
				const parsed = JSON.parse(normalizedSource) as GeoJsonObject | Topology;
				const [{ geoMercator, geoPath }, topojson] = await Promise.all([
					import("d3-geo"),
					import("topojson-client"),
				]);

				const featureCollection: FeatureCollection<Geometry> = isTopology(
					parsed,
				)
					? {
							type: "FeatureCollection",
							features: Object.values(parsed.objects).flatMap((object) => {
								const converted = topojson.feature(parsed, object as never) as
									| Feature<Geometry>
									| FeatureCollection<Geometry>;

								return converted.type === "FeatureCollection"
									? converted.features
									: [converted];
							}),
						}
					: geoJsonToFeatureCollection(parsed);

				if (!featureCollection.features.length) {
					throw new Error("No renderable features were found.");
				}

				const projection = geoMercator().fitExtent(
					[
						[SVG_PADDING, SVG_PADDING],
						[SVG_WIDTH - SVG_PADDING, SVG_HEIGHT - SVG_PADDING],
					],
					featureCollection,
				);
				const pathGenerator = geoPath(projection).pointRadius(4);
				const nextPaths: RenderedPath[] = [];

				for (const [index, feature] of featureCollection.features.entries()) {
					const d = pathGenerator(feature);

					if (!d) {
						continue;
					}

					nextPaths.push({
						d,
						geometryType: feature.geometry?.type ?? null,
						key: String(feature.id ?? index),
					});
				}

				if (!nextPaths.length) {
					throw new Error("No SVG paths could be generated from this map.");
				}

				if (cancelled) {
					return;
				}

				setPaths(nextPaths);
				setError(null);
			} catch (err) {
				if (!cancelled) {
					setPaths([]);
					setError(
						err instanceof Error
							? err.message
							: `Failed to render ${format.toUpperCase()} map.`,
					);
				}
			}
		}

		void renderMap();

		return () => {
			cancelled = true;
		};
	}, [format, normalizedSource]);

	if (error) {
		return (
			<div className="not-prose my-4 overflow-x-auto rounded-lg border bg-muted/20 p-4">
				<pre className="overflow-x-auto whitespace-pre-wrap text-sm">
					<code>{normalizedSource}</code>
				</pre>
				<p className="mt-3 text-sm text-destructive">
					{format.toUpperCase()} render failed: {error}
				</p>
			</div>
		);
	}

	return (
		<div className="not-prose my-4 overflow-hidden rounded-lg border bg-muted/20 p-4">
			<svg
				viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
				className="h-auto w-full rounded-md border border-border/60 bg-background"
				data-testid={`${format}-block`}
				role="img"
			>
				<title>{`${format.toUpperCase()} preview`}</title>
				<rect
					width={SVG_WIDTH}
					height={SVG_HEIGHT}
					fill="var(--background)"
					rx="12"
				/>
				{paths.map((path) => (
					<path
						key={path.key}
						d={path.d}
						strokeLinecap="round"
						strokeLinejoin="round"
						{...pathPropsForGeometry(path.geometryType)}
					/>
				))}
			</svg>
		</div>
	);
}
