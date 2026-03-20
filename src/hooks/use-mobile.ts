import * as React from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = React.useState<boolean>(() => {
		if (typeof window === "undefined") {
			return false;
		}

		return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
	});

	React.useEffect(() => {
		if (typeof window === "undefined") {
			return undefined;
		}

		const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
		const updateIsMobile = (event?: MediaQueryListEvent) => {
			setIsMobile(event?.matches ?? mediaQuery.matches);
		};

		updateIsMobile();
		mediaQuery.addEventListener("change", updateIsMobile);

		return () => mediaQuery.removeEventListener("change", updateIsMobile);
	}, []);

	return isMobile;
}
