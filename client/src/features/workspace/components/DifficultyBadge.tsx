import type { Difficulty } from "@shared";
import type { FunctionComponent } from "@/common/types";

const STYLES: Record<Difficulty, string> = {
	Easy: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
	Medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
	Hard: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

export const DifficultyBadge = ({
	difficulty,
}: {
	difficulty: Difficulty;
}): FunctionComponent => {
	return (
		<span
			className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[difficulty]}`}
		>
			{difficulty}
		</span>
	);
};
