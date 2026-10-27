import { AppCard } from "@/components/apps/AppCard";
import { Button, Modal } from "@/components/ui/primitives";
import {
	type QuickSetupId,
	isLegacyAlexa,
	quickSetupDone,
	quickSetupItems,
	runQuickSetupItem,
} from "@/lib/adb/quick-setup";
import { APP_CATALOG } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useDeviceStore } from "@/store/device-store";
import { Check, ChevronRight, Loader2, Rocket, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type Status = "running" | "done" | "error";

const IMMORTAL = APP_CATALOG.find((a) => a.id === "immortal-launcher");

// Portals that already got the checklist this browser session (by serial).
const SHOWN_KEY = "jailportal-quick-setup";

function alreadyShown(serial: string): boolean {
	try {
		const list = JSON.parse(sessionStorage.getItem(SHOWN_KEY) ?? "[]");
		return Array.isArray(list) && list.includes(serial);
	} catch {
		return false;
	}
}

function markShown(serial: string): void {
	try {
		const list = JSON.parse(sessionStorage.getItem(SHOWN_KEY) ?? "[]");
		const next = Array.isArray(list) ? [...list, serial] : [serial];
		sessionStorage.setItem(SHOWN_KEY, JSON.stringify(next));
	} catch {
		// Private mode or blocked storage: the checklist just opens again next time.
	}
}

/**
 * First-connection checklist: tick what you want (home screen with
 * hands-free Alexa, Meta's Alexa, clean-up) and run it in one go. Opens by
 * itself the first time a Portal connects in this session; the card reopens it.
 */
export function QuickSetupCard() {
	const { t } = useTranslation("dashboard");
	const { t: tc } = useTranslation();
	const adb = useDeviceStore((s) => s.adb);
	const serial = useDeviceStore((s) => s.deviceInfo?.serial);
	const apiLevel = useDeviceStore((s) => Number(s.deviceInfo?.apiLevel ?? 0));
	const items = useMemo(() => quickSetupItems(apiLevel), [apiLevel]);
	const legacy = isLegacyAlexa(apiLevel);
	const refreshDeviceInfo = useDeviceStore((s) => s.refreshDeviceInfo);
	const refreshInstalled = useAppStore((s) => s.refreshInstalled);

	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [installed, setInstalled] = useState<Set<QuickSetupId> | null>(null);
	const [selected, setSelected] = useState<Set<QuickSetupId>>(new Set());
	const [status, setStatus] = useState<Partial<Record<QuickSetupId, Status>>>(
		{},
	);
	const [percent, setPercent] = useState<number | null>(null);

	useEffect(() => {
		if (adb && serial && !alreadyShown(serial)) {
			markShown(serial);
			setOpen(true);
		}
	}, [adb, serial]);

	const load = useCallback(async () => {
		const done = adb ? await quickSetupDone(adb) : new Set<QuickSetupId>();
		setInstalled(done);
		// Pre-tick what is missing; things already there stay unticked.
		setSelected(new Set(items.map((i) => i.id).filter((id) => !done.has(id))));
	}, [adb, items]);

	useEffect(() => {
		if (open) {
			setStatus({});
			setInstalled(null);
			load().catch(() => setInstalled(new Set()));
		}
	}, [open, load]);

	const toggle = (id: QuickSetupId) =>
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const run = async () => {
		if (!adb) return;
		setBusy(true);
		let failed = 0;
		for (const item of items) {
			if (!selected.has(item.id)) continue;
			setStatus((s) => ({ ...s, [item.id]: "running" }));
			setPercent(null);
			try {
				await runQuickSetupItem(adb, item.id, (_stage, p) => setPercent(p));
				setStatus((s) => ({ ...s, [item.id]: "done" }));
			} catch (err) {
				failed++;
				setStatus((s) => ({ ...s, [item.id]: "error" }));
				toast.error(t(`quick.${item.id}.title`), {
					description: err instanceof Error ? err.message : tc("error"),
				});
			}
		}
		setBusy(false);
		if (failed === 0) {
			toast.success(t("quick.done"), { description: t("quick.doneHint") });
		}
		await Promise.all([refreshDeviceInfo(), refreshInstalled()]);
	};

	const finished =
		Object.keys(status).length > 0 &&
		!busy &&
		Object.values(status).every((s) => s === "done");

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50"
			>
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10">
					<Rocket className="h-6 w-6 text-brand" />
				</div>
				<div className="min-w-0 flex-1">
					<h4 className="text-sm font-medium">{t("quick.title")}</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						{t("quick.desc")}
					</p>
				</div>
				<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
			</button>

			<Modal
				open={open}
				onClose={() => !busy && setOpen(false)}
				title={t("quick.title")}
				footer={
					<>
						<Button
							variant="ghost"
							disabled={busy}
							onClick={() => setOpen(false)}
						>
							{finished ? tc("close") : t("quick.later")}
						</Button>
						{!finished && (
							<Button
								variant="primary"
								loading={busy}
								disabled={!adb || !installed || selected.size === 0}
								onClick={run}
							>
								{t("quick.run")}
							</Button>
						)}
					</>
				}
			>
				<div className="space-y-3">
					<p className="text-muted-foreground">{t("quick.intro")}</p>
					{items.map((item) => {
						const s = status[item.id];
						return (
							<label
								key={item.id}
								className={cn(
									"flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background/50 px-3 py-2.5",
									busy && "cursor-default",
								)}
							>
								<input
									type="checkbox"
									checked={selected.has(item.id)}
									disabled={busy || !installed}
									onChange={() => toggle(item.id)}
									className="mt-0.5 h-4 w-4 shrink-0 accent-sky-500"
								/>
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="font-medium">
										{t(`quick.${item.id}.title`)}
									</span>
									<span className="text-xs text-muted-foreground">
										{t(`quick.${item.id}.hint`)}
									</span>
									{installed?.has(item.id) && !s && (
										<span className="text-xs text-emerald-500">
											{t("quick.installed")}
										</span>
									)}
								</span>
								<span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
									{s === "running" && (
										<>
											<Loader2 className="h-4 w-4 animate-spin" />
											{percent !== null && `${Math.round(percent)} %`}
										</>
									)}
									{s === "done" && (
										<Check className="h-4 w-4 text-emerald-500" />
									)}
									{s === "error" && <X className="h-4 w-4 text-red-500" />}
								</span>
							</label>
						);
					})}
					{legacy && IMMORTAL && (
						<div className="space-y-2 border-t border-border pt-3">
							<p className="text-xs text-muted-foreground">
								{t("quick.legacy")}
							</p>
							<AppCard app={IMMORTAL} />
						</div>
					)}
					{finished && selected.has("alexa") && (
						<p className="text-xs text-muted-foreground">{t("quick.signIn")}</p>
					)}
				</div>
			</Modal>
		</>
	);
}
