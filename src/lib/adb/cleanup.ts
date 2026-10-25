import type { Adb } from "@yume-chan/adb";
import { execShell } from "./shell";

/**
 * Meta system apps a Portal can live without. They are removed for user 0
 * only (`pm uninstall --user 0`): the APK stays on the read-only system
 * partition, so `cmd package install-existing` brings any of them back.
 * `defaultOn: false` marks apps people still commonly use.
 */
export const REMOVABLE_META_APPS = [
	{
		packageName: "com.facebook.aloha.app.whatsapp",
		key: "whatsapp",
		defaultOn: true,
	},
	{
		packageName: "com.facebook.alohaapps.superframe",
		key: "superframe",
		defaultOn: true,
	},
	{
		packageName: "com.facebook.aloha.app.portalfeed",
		key: "portalfeed",
		defaultOn: true,
	},
	{
		packageName: "com.facebook.aloha.app.storytime",
		key: "storytime",
		defaultOn: true,
	},
	{
		packageName: "com.facebook.aloha.app.cameraeditor",
		key: "cameraeditor",
		defaultOn: true,
	},
	{
		packageName: "com.facebook.aloha.app.messenger",
		key: "messenger",
		defaultOn: false,
	},
] as const;

export type RemovableMetaApp = (typeof REMOVABLE_META_APPS)[number];

/** Free space on /data, in bytes. */
export async function getDataFreeBytes(adb: Adb): Promise<number> {
	const { stdout } = await execShell(adb, "df -k /data");
	const line = stdout.trim().split("\n").at(-1) ?? "";
	const available = Number(line.trim().split(/\s+/)[3]);
	return Number.isFinite(available) ? available * 1024 : 0;
}

/** Asks Android to drop every app cache it can (apps rebuild them as needed). */
export async function trimAppCaches(adb: Adb): Promise<void> {
	await execShell(adb, "pm trim-caches 999G", { timeoutMs: 120_000 });
}

/** Package names currently installed for user 0 among the given ones. */
export async function installedForUser(
	adb: Adb,
	packageNames: readonly string[],
): Promise<Set<string>> {
	const { stdout } = await execShell(adb, "pm list packages --user 0");
	const present = new Set(
		stdout
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.startsWith("package:"))
			.map((l) => l.slice("package:".length)),
	);
	return new Set(packageNames.filter((p) => present.has(p)));
}

export async function removeForUser(
	adb: Adb,
	packageName: string,
): Promise<void> {
	const { stdout } = await execShell(
		adb,
		`pm uninstall --user 0 ${packageName}`,
	);
	if (!stdout.includes("Success")) {
		throw new Error(stdout.trim() || `Failed to remove ${packageName}`);
	}
}

export async function restoreForUser(
	adb: Adb,
	packageName: string,
): Promise<void> {
	const { stdout } = await execShell(
		adb,
		`cmd package install-existing ${packageName}`,
	);
	if (!/installed for user|Success/i.test(stdout)) {
		throw new Error(stdout.trim() || `Failed to restore ${packageName}`);
	}
}
