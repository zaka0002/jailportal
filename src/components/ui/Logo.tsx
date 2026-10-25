import { cn } from "@/lib/utils";
import { useId } from "react";

/**
 * JailPortal mark: the Portal's rounded screen with prison bars, the last one
 * bent open (jailbreak). Meta's blue palette, never Meta's own logo.
 */
export function LogoMark({ className }: { className?: string }) {
	const id = useId();
	return (
		<svg
			viewBox="0 0 32 32"
			className={cn("shrink-0", className)}
			aria-hidden="true"
		>
			<defs>
				{/* userSpaceOnUse: a bounding-box gradient can't paint the zero-width bars */}
				<linearGradient
					id={id}
					gradientUnits="userSpaceOnUse"
					x1="4.5"
					y1="27.5"
					x2="27.5"
					y2="4.5"
				>
					<stop offset="0" stopColor="#0064e0" />
					<stop offset="1" stopColor="#00b2ff" />
				</linearGradient>
			</defs>
			<rect
				x="4.5"
				y="4.5"
				width="23"
				height="23"
				rx="7"
				fill="none"
				stroke={`url(#${id})`}
				strokeWidth="3.5"
			/>
			<g
				fill="none"
				stroke={`url(#${id})`}
				strokeWidth="2.6"
				strokeLinecap="round"
			>
				<path d="M 11.5 10 V 22" />
				<path d="M 16 10 V 22" />
				<path d="M 20.5 22 V 17 Q 20.5 12.5 24.5 10.5" />
			</g>
		</svg>
	);
}

export function LogoWordmark({ className }: { className?: string }) {
	return (
		<span className={cn("tracking-tight", className)}>
			Jail
			<span className="text-brand dark:text-brand-light">Portal</span>
		</span>
	);
}
