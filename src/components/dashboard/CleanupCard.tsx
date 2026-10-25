import { Button, Modal } from "@/components/ui/primitives";
import {
	REMOVABLE_META_APPS,
	getDataFreeBytes,
	installedForUser,
	removeForUser,
	restoreForUser,
	trimAppCaches,
} from "@/lib/adb/cleanup";
import { formatBytes } from "@/lib/utils/format";
import { useDeviceStore } from "@/store/device-store";
import { ChevronRight, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const ALL_PACKAGES = REMOVABLE_META_APPS.map((a) => a.packageName);

/**
 * Dashboard action: free storage and memory by trimming app caches and
 * removing unused Meta apps for the user (each one restorable).
 */
export function CleanupCard() {
	const { t } = useTranslation("dashboard");
	const { t: tc } = useTranslation();
	const adb = useDeviceStore((s) => s.adb);
	const refreshDeviceInfo = useDeviceStore((s) => s.refreshDeviceInfo);

	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [present, setPresent] = useState<Set<string> | null>(null);
	const [caches, setCaches] = useState(true);
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const loadPresent = useCallback(async () => {
		if (!adb) return;
		const found = await installedForUser(adb, ALL_PACKAGES);
		setPresent(found);
		setSelected(
			new Set(
				REMOVABLE_META_APPS.filter(
					(a) => a.defaultOn && found.has(a.packageName),
				).map((a) => a.packageName),
			),
		);
	}, [adb]);

	useEffect(() => {
		if (open) {
			setCaches(true);
			setPresent(null);
			loadPresent().catch(() => setPresent(new Set()));
		}
	}, [open, loadPresent]);

	const toggle = (pkg: string) =>
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(pkg)) next.delete(pkg);
			else next.add(pkg);
			return next;
		});

	const run = async () => {
		if (!adb) return;
		setBusy(true);
		try {
			const before = await getDataFreeBytes(adb);
			if (caches) await trimAppCaches(adb);
			const failed: string[] = [];
			for (const pkg of selected) {
				try {
					await removeForUser(adb, pkg);
				} catch {
					failed.push(pkg);
				}
			}
			const after = await getDataFreeBytes(adb);
			toast.success(t("cleanupDone"), {
				description: t("cleanupFreed", {
					size: formatBytes(Math.max(0, after - before)),
				}),
			});
			if (failed.length > 0) {
				toast.error(t("cleanupSomeFailed", { list: failed.join(", ") }));
			}
			await refreshDeviceInfo();
			setOpen(false);
		} catch (err) {
			toast.error(t("cleanup"), {
				description: err instanceof Error ? err.message : tc("error"),
			});
		} finally {
			setBusy(false);
		}
	};

	const restore = async (pkg: string) => {
		if (!adb) return;
		setBusy(true);
		try {
			await restoreForUser(adb, pkg);
			toast.success(t("cleanupRestored"));
			await loadPresent();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : tc("error"));
		} finally {
			setBusy(false);
		}
	};

	const removed = present
		? REMOVABLE_META_APPS.filter((a) => !present.has(a.packageName))
		: [];
	const removable = present
		? REMOVABLE_META_APPS.filter((a) => present.has(a.packageName))
		: [];

	return (
		<>
			<button
				type="button"
				disabled={!adb}
				onClick={() => setOpen(true)}
				className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
			>
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10">
					<Sparkles className="h-6 w-6 text-brand" />
				</div>
				<div className="min-w-0 flex-1">
					<h4 className="text-sm font-medium">{t("cleanup")}</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						{t("cleanupDesc")}
					</p>
				</div>
				<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
			</button>

			<Modal
				open={open}
				onClose={() => !busy && setOpen(false)}
				title={t("cleanup")}
				footer={
					<>
						<Button
							variant="ghost"
							disabled={busy}
							onClick={() => setOpen(false)}
						>
							{tc("cancel")}
						</Button>
						<Button
							variant="primary"
							loading={busy}
							disabled={!present || (!caches && selected.size === 0)}
							onClick={run}
						>
							{t("cleanupRun")}
						</Button>
					</>
				}
			>
				<div className="space-y-3">
					<p className="text-muted-foreground">{t("cleanupIntro")}</p>

					<Option
						checked={caches}
						onChange={() => setCaches((v) => !v)}
						title={t("cleanupCaches")}
						hint={t("cleanupCachesHint")}
					/>

					{present === null ? (
						<p className="text-xs text-muted-foreground">
							{t("cleanupLoading")}
						</p>
					) : (
						removable.map((a) => (
							<Option
								key={a.packageName}
								checked={selected.has(a.packageName)}
								onChange={() => toggle(a.packageName)}
								title={t(`cleanupApp.${a.key}`)}
								hint={a.packageName}
							/>
						))
					)}

					{removed.length > 0 && (
						<div className="space-y-2 border-t border-border pt-3">
							<p className="text-xs text-muted-foreground">
								{t("cleanupRemovedIntro")}
							</p>
							{removed.map((a) => (
								<div
									key={a.packageName}
									className="flex items-center justify-between gap-2 text-xs"
								>
									<span>{t(`cleanupApp.${a.key}`)}</span>
									<Button
										variant="ghost"
										disabled={busy}
										onClick={() => restore(a.packageName)}
									>
										{t("cleanupRestore")}
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			</Modal>
		</>
	);
}

function Option({
	checked,
	onChange,
	title,
	hint,
}: {
	checked: boolean;
	onChange: () => void;
	title: string;
	hint: string;
}) {
	return (
		<label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background/50 px-3 py-2.5">
			<input
				type="checkbox"
				checked={checked}
				onChange={onChange}
				className="mt-0.5 h-4 w-4 shrink-0 accent-sky-500"
			/>
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className="font-medium">{title}</span>
				<span className="truncate text-xs text-muted-foreground">{hint}</span>
			</span>
		</label>
	);
}
