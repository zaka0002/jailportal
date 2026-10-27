import type { Adb } from "@yume-chan/adb";
import {
	REMOVABLE_META_APPS,
	installedForUser,
	removeForUser,
	trimAppCaches,
} from "./cleanup";
import { type InstallProgressFn, installApp } from "./install";
import { execShell } from "./shell";

/**
 * The first-connection checklist: what a Portal needs for a nice home screen
 * with hands-free Alexa. These are not catalog apps on purpose; they are
 * offered once, as one setup, right after connecting.
 */
export type QuickSetupId = "home" | "alexa" | "cleanup";

export interface QuickSetupItem {
	id: QuickSetupId;
	/** Package whose presence means the item is already done (none for clean-up). */
	packageName?: string;
}

const HOME_PACKAGE = "fr.portal.accueil";
const HOME_APK =
	"https://github.com/zaka0002/portal-accueil/releases/latest/download/portal-accueil.apk";

const FALCON_PACKAGE = "com.amazon.alexa.multimodal.falcon";
const FALCON_APK =
	"https://github.com/starbrightlab/hey-dist/releases/download/v0.1.0/falcon.apk";
const FALCON_SHA256 =
	"76133f807e492e46aaf58e6ae503e623a93af840eaa3eccfb8630f1ecab3268d";

/** Run order. Alexa goes last so its amazon.com/code sign-in stays on screen. */
export const QUICK_SETUP_ITEMS: readonly QuickSetupItem[] = [
	{ id: "home", packageName: HOME_PACKAGE },
	{ id: "cleanup" },
	{ id: "alexa", packageName: FALCON_PACKAGE },
];

/**
 * Items offered on a Portal at this API level. Gen-1 Portals (Android 9) can
 * run Meta's Alexa with its own "Hey Alexa" again, which Immortal's setup
 * restores, so the Android 10 workaround (Portal Accueil + falcon) is left out.
 */
export function quickSetupItems(apiLevel: number): readonly QuickSetupItem[] {
	return isLegacyAlexa(apiLevel)
		? QUICK_SETUP_ITEMS.filter((i) => i.id === "cleanup")
		: QUICK_SETUP_ITEMS;
}

export function isLegacyAlexa(apiLevel: number): boolean {
	return apiLevel > 0 && apiLevel < 29;
}

/** Which of the items are already on the Portal. */
export async function quickSetupDone(adb: Adb): Promise<Set<QuickSetupId>> {
	const packages = QUICK_SETUP_ITEMS.flatMap((i) =>
		i.packageName ? [i.packageName] : [],
	);
	const present = await installedForUser(adb, packages);
	return new Set(
		QUICK_SETUP_ITEMS.filter(
			(i) => i.packageName && present.has(i.packageName),
		).map((i) => i.id),
	);
}

export async function runQuickSetupItem(
	adb: Adb,
	id: QuickSetupId,
	onProgress?: InstallProgressFn,
): Promise<void> {
	switch (id) {
		case "home":
			return installHome(adb, onProgress);
		case "alexa":
			return installAlexa(adb, onProgress);
		case "cleanup":
			return cleanUp(adb);
	}
}

/**
 * Portal Accueil: the home screen that also listens for "Alexa". Réveil Alexa
 * does the same job from the background, so it is removed or both would answer.
 */
async function installHome(
	adb: Adb,
	onProgress?: InstallProgressFn,
): Promise<void> {
	await installApp(
		adb,
		{ kind: "url", urls: HOME_APK },
		{ flags: "-r -g", onProgress },
	);
	await removeIfPresent(adb, ["fr.portal.reveilalexa"]);
	await run(adb, [
		`appops set ${HOME_PACKAGE} SYSTEM_ALERT_WINDOW allow`,
		`dumpsys deviceidle whitelist +${HOME_PACKAGE}`,
		`cmd package set-home-activity ${HOME_PACKAGE}/.HomeActivity`,
		"am start -a android.intent.action.MAIN -c android.intent.category.HOME",
	]);
}

/**
 * Meta's own Alexa client (falcon), revived by Starbright Lab. The Amazon
 * Alexa phone app blocks its install, and without these grants it stays
 * disconnected ("no internet"). Ends on its amazon.com/code sign-in.
 */
async function installAlexa(
	adb: Adb,
	onProgress?: InstallProgressFn,
): Promise<void> {
	await removeIfPresent(adb, ["com.amazon.dee.app"]);
	await installApp(
		adb,
		{ kind: "url", urls: FALCON_APK, sha256: FALCON_SHA256 },
		{ onProgress },
	);
	await run(adb, [
		`pm grant ${FALCON_PACKAGE} android.permission.RECORD_AUDIO`,
		`pm grant ${FALCON_PACKAGE} android.permission.READ_PHONE_STATE`,
		`pm grant ${FALCON_PACKAGE} android.permission.INTERACT_ACROSS_USERS`,
		`appops set ${FALCON_PACKAGE} SYSTEM_ALERT_WINDOW allow`,
		"settings put secure user_setup_complete 1",
		`am force-stop ${FALCON_PACKAGE}`,
		`am start -n ${FALCON_PACKAGE}/com.amazon.alexa.multimodal.LaunchActivity`,
	]);
}

/** App caches plus the Meta apps marked safe to remove (each restorable). */
async function cleanUp(adb: Adb): Promise<void> {
	await trimAppCaches(adb);
	const defaults = REMOVABLE_META_APPS.filter((a) => a.defaultOn).map(
		(a) => a.packageName,
	);
	for (const pkg of await installedForUser(adb, defaults)) {
		await removeForUser(adb, pkg);
	}
}

async function removeIfPresent(
	adb: Adb,
	packageNames: readonly string[],
): Promise<void> {
	for (const pkg of await installedForUser(adb, packageNames)) {
		await execShell(adb, `pm uninstall ${pkg}`);
	}
}

async function run(adb: Adb, commands: readonly string[]): Promise<void> {
	for (const command of commands) {
		await execShell(adb, command);
	}
}
