import { ShieldAlert } from "lucide-react";
import * as React from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const GITHUB_PAT_SETTINGS_URL =
	"https://github.com/settings/personal-access-tokens";
const REMINDER_ACK_STORAGE_KEY = "token-leave-reminder-acknowledged";

interface PendingNavigation {
	href: string;
	target: string | null;
	rel: string | null;
}

interface TokenLeaveAlertProps {
	enabled: boolean;
}

function openExternalTarget({ href, target, rel }: PendingNavigation) {
	if (target && target !== "_self") {
		const features = rel?.includes("noopener")
			? "noopener,noreferrer"
			: undefined;
		window.open(href, target, features);
		return;
	}

	window.location.href = href;
}

export function TokenLeaveAlert({ enabled }: TokenLeaveAlertProps) {
	const [open, setOpen] = React.useState(false);
	const [hasAcknowledgedReminder, setHasAcknowledgedReminder] =
		React.useState(false);
	const pendingNavigationRef = React.useRef<PendingNavigation | null>(null);
	const bypassBeforeUnloadRef = React.useRef(false);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		setHasAcknowledgedReminder(
			window.sessionStorage.getItem(REMINDER_ACK_STORAGE_KEY) === "true",
		);
	}, []);

	React.useEffect(() => {
		if (
			!enabled ||
			hasAcknowledgedReminder ||
			typeof document === "undefined"
		) {
			return;
		}

		const handleDocumentClick = (event: MouseEvent) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			) {
				return;
			}

			const target = event.target;
			if (!(target instanceof Element)) return;

			const link = target.closest("a[href]");
			if (!(link instanceof HTMLAnchorElement)) return;
			if (link.dataset.tokenReminderAllow === "true") return;

			const href = link.getAttribute("href");
			if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
				return;
			}

			const destination = new URL(href, window.location.href);
			if (destination.origin === window.location.origin) return;

			event.preventDefault();
			pendingNavigationRef.current = {
				href: destination.toString(),
				target: link.getAttribute("target"),
				rel: link.getAttribute("rel"),
			};
			setOpen(true);
		};

		document.addEventListener("click", handleDocumentClick, true);
		return () =>
			document.removeEventListener("click", handleDocumentClick, true);
	}, [enabled, hasAcknowledgedReminder]);

	React.useEffect(() => {
		if (!enabled || typeof window === "undefined") return;

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (bypassBeforeUnloadRef.current) return;
			event.preventDefault();
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [enabled]);

	const acknowledgeReminder = React.useCallback(() => {
		setHasAcknowledgedReminder(true);
		if (typeof window !== "undefined") {
			window.sessionStorage.setItem(REMINDER_ACK_STORAGE_KEY, "true");
		}
	}, []);

	const handleContinue = React.useCallback(() => {
		const pendingNavigation = pendingNavigationRef.current;
		setOpen(false);
		acknowledgeReminder();

		if (!pendingNavigation) return;

		bypassBeforeUnloadRef.current = true;
		openExternalTarget(pendingNavigation);
	}, [acknowledgeReminder]);

	const handleOpenTokenSettings = React.useCallback(() => {
		setOpen(false);
		acknowledgeReminder();
		window.open(GITHUB_PAT_SETTINGS_URL, "_blank", "noopener,noreferrer");
	}, [acknowledgeReminder]);

	return (
		<AlertDialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) {
					pendingNavigationRef.current = null;
				}
			}}
		>
			<AlertDialogContent size="default" className="max-w-md sm:max-w-lg">
				<AlertDialogHeader>
					<AlertDialogMedia className="bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
						<ShieldAlert className="size-4" />
					</AlertDialogMedia>
					<AlertDialogTitle className="text-base sm:text-lg">
						Deactivate your token when you're done
					</AlertDialogTitle>
					<AlertDialogDescription className="text-sm">
						If this personal access token belongs to you and you no longer need
						to share this repository, deactivate or delete it in GitHub token
						settings.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="sm:grid-cols-1">
					<AlertDialogCancel>Stay here</AlertDialogCancel>
					<AlertDialogAction
						variant="outline"
						onClick={handleOpenTokenSettings}
					>
						Open token settings
					</AlertDialogAction>
					<AlertDialogAction onClick={handleContinue}>
						Continue leaving
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
