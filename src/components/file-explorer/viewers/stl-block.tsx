import * as React from "react";

interface StlBlockProps {
	source: string;
}

function getContainerSize(element: HTMLDivElement) {
	return {
		height: Math.max(element.clientHeight, 280),
		width: Math.max(element.clientWidth, 320),
	};
}

export function StlBlock({ source }: StlBlockProps) {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const normalizedSource = React.useMemo(() => source.trim(), [source]);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		let animationFrame = 0;
		let cancelled = false;
		let observer: ResizeObserver | undefined;

		async function renderModel() {
			if (!containerRef.current) {
				return;
			}

			try {
				const THREE = await import("three");
				const [{ OrbitControls }, { STLLoader }] = await Promise.all([
					import("three/examples/jsm/controls/OrbitControls.js"),
					import("three/examples/jsm/loaders/STLLoader.js"),
				]);

				if (cancelled || !containerRef.current) {
					return;
				}

				const host = containerRef.current;
				const renderer = new THREE.WebGLRenderer({
					antialias: true,
					alpha: true,
				});
				renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
				host.replaceChildren(renderer.domElement);

				const scene = new THREE.Scene();
				const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
				const controls = new OrbitControls(camera, renderer.domElement);
				controls.enableDamping = true;
				controls.target.set(0, 0, 0);

				const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
				const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
				keyLight.position.set(6, 8, 10);
				const rimLight = new THREE.DirectionalLight(0xffffff, 0.7);
				rimLight.position.set(-5, 6, -8);
				scene.add(ambientLight, keyLight, rimLight);

				const loader = new STLLoader();
				const geometry = loader.parse(normalizedSource);
				geometry.computeVertexNormals();
				geometry.center();
				geometry.computeBoundingSphere();

				const radius = geometry.boundingSphere?.radius || 1;
				const material = new THREE.MeshStandardMaterial({
					color: 0x58a6ff,
					metalness: 0.14,
					roughness: 0.52,
					side: THREE.DoubleSide,
				});
				const mesh = new THREE.Mesh(geometry, material);
				scene.add(mesh);

				const gridSize = Math.max(radius * 6, 8);
				const grid = new THREE.GridHelper(gridSize, 12, 0x64748b, 0xcbd5e1);
				grid.position.y = -(radius * 1.15);
				scene.add(grid);

				camera.position.set(radius * 2.8, radius * 1.7, radius * 2.8);
				camera.near = Math.max(radius / 100, 0.1);
				camera.far = Math.max(radius * 25, 50);
				camera.lookAt(0, 0, 0);

				const resizeRenderer = () => {
					const { width, height } = getContainerSize(host);
					renderer.setSize(width, height, false);
					camera.aspect = width / height;
					camera.updateProjectionMatrix();
				};

				resizeRenderer();
				controls.update();

				observer = new ResizeObserver(() => resizeRenderer());
				observer.observe(host);

				const tick = () => {
					if (cancelled) {
						return;
					}

					controls.update();
					renderer.render(scene, camera);
					animationFrame = window.requestAnimationFrame(tick);
				};

				setError(null);
				tick();

				return () => {
					window.cancelAnimationFrame(animationFrame);
					observer?.disconnect();
					controls.dispose();
					geometry.dispose();
					material.dispose();
					renderer.dispose();
					host.replaceChildren();
				};
			} catch (err) {
				if (!cancelled) {
					setError(
						err instanceof Error ? err.message : "Failed to render STL model.",
					);
				}
			}
		}

		let cleanup: (() => void) | undefined;

		void renderModel().then((result) => {
			cleanup = result;
		});

		return () => {
			cancelled = true;
			window.cancelAnimationFrame(animationFrame);
			observer?.disconnect();
			cleanup?.();
		};
	}, [normalizedSource]);

	if (error) {
		return (
			<div className="not-prose my-4 overflow-x-auto rounded-lg border bg-muted/20 p-4">
				<pre className="overflow-x-auto whitespace-pre-wrap text-sm">
					<code>{normalizedSource}</code>
				</pre>
				<p className="mt-3 text-sm text-destructive">
					STL render failed: {error}
				</p>
			</div>
		);
	}

	return (
		<div className="not-prose my-4 overflow-hidden rounded-lg border bg-muted/20 p-4">
			<div
				ref={containerRef}
				className="h-[320px] w-full overflow-hidden rounded-md border border-border/60 bg-background"
				data-testid="stl-block"
			/>
		</div>
	);
}
