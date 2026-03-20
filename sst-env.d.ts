type SstAppInput = {
	stage?: string;
};

type SstAppConfig = {
	home: string;
	name: string;
	protect: boolean;
	providers?: {
		aws?: {
			profile?: string;
		};
	};
	removal: string;
};

type SstTanStackStartProps = {
	domain?: {
		aliases?: string[];
		name: string;
		redirects?: string[];
	};
	environment?: Record<string, string>;
	link?: unknown[];
	path: string;
};

declare const $app: {
	stage: string;
};

declare function $config<T extends {
	app(input: SstAppInput): SstAppConfig;
	run(): Promise<void> | void;
}>(config: T): T;

declare namespace sst {
	class Secret {
		constructor(name: string);
		value: string;
	}

	namespace aws {
		class TanStackStart {
			constructor(name: string, props: SstTanStackStartProps);
		}
	}
}
