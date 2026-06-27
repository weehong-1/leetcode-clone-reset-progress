import { useEffect, useRef } from "react";
import type { ProblemListSummary } from "@shared";
import type { FunctionComponent } from "@/common/types";

/** Approximate panel size, used to clamp the menu inside the viewport. */
const PANEL_WIDTH = 224;
const PANEL_MARGIN = 8;

export type MenuPosition = { x: number; y: number };

/**
 * A lightweight right-click context menu that adds a problem to one of the
 * user's custom lists. Positioned at the cursor (HeadlessUI's `Menu` can't
 * anchor to a point), and closes on outside click, Escape, or a pick.
 */
export const AddToListMenu = ({
	position,
	lists,
	onPick,
	onClose,
}: {
	position: MenuPosition | null;
	lists: Array<ProblemListSummary>;
	onPick: (listId: string) => void;
	onClose: () => void;
}): FunctionComponent => {
	const panelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!position) return;

		const onPointerDown = (event: MouseEvent): void => {
			if (!panelRef.current?.contains(event.target as Node)) onClose();
		};
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") onClose();
		};

		window.addEventListener("mousedown", onPointerDown);
		window.addEventListener("keydown", onKeyDown);
		return (): void => {
			window.removeEventListener("mousedown", onPointerDown);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [position, onClose]);

	if (!position) return null;

	// Keep the panel on-screen near the right/bottom edges.
	const left = Math.min(
		position.x,
		window.innerWidth - PANEL_WIDTH - PANEL_MARGIN
	);
	const top = Math.min(position.y, window.innerHeight - PANEL_MARGIN);

	return (
		<div
			ref={panelRef}
			className="fixed z-50 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
			style={{ left, top }}
		>
			<p className="px-3 py-1.5 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
				Add to list
			</p>
			{lists.length === 0 ? (
				<p className="px-3 py-1.5 text-base text-gray-400 dark:text-gray-500">
					No custom lists yet — create one first.
				</p>
			) : (
				<ul className="max-h-72 overflow-y-auto">
					{lists.map((list) => (
						<li key={list.id}>
							<button
								className="block w-full truncate px-3 py-1.5 text-left text-base text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
								type="button"
								onClick={(): void => { onPick(list.id); }}
							>
								{list.name}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};
