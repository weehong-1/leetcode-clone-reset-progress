import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";
import type { FunctionComponent } from "@/common/types";

interface SaveAnswerDialogProps {
	open: boolean;
	/** Editor code used to seed the (editable) code field each time it opens. */
	initialCode: string;
	/** Language slug, shown as a label on the code field. */
	lang: string;
	saving: boolean;
	error: string | null;
	onClose: () => void;
	onSave: (data: { name: string; note: string; code: string }) => void;
}

type FormProps = Omit<SaveAnswerDialogProps, "open">;

/**
 * Inner form, mounted fresh on each open so `useState` reseeds from the live
 * editor code with blank name/note — no synchronizing effect needed.
 */
const SaveAnswerForm = ({
	initialCode,
	lang,
	saving,
	error,
	onClose,
	onSave,
}: FormProps): FunctionComponent => {
	const [name, setName] = useState("");
	const [note, setNote] = useState("");
	const [code, setCode] = useState(initialCode);

	const canSave = code.trim().length > 0 && !saving;

	return (
		<form
			className="flex min-h-0 flex-col"
			onSubmit={(event): void => {
				event.preventDefault();
				if (canSave) onSave({ name, note, code });
			}}
		>
			<DialogTitle className="border-b border-gray-200 px-5 py-3 text-base font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
				Save Answer
			</DialogTitle>

			<div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-4">
				<div>
					<label className="mb-1 block text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
						Name
					</label>
					<input
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
						maxLength={120}
						placeholder="Name this approach… (e.g. Hash map O(n))"
						value={name}
						onChange={(event): void => { setName(event.target.value); }}
					/>
				</div>

				<div>
					<label className="mb-1 block text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
						Note
					</label>
					<textarea
						className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
						maxLength={5000}
						placeholder="Notes (trade-offs, complexity, what to try next)…"
						rows={3}
						value={note}
						onChange={(event): void => { setNote(event.target.value); }}
					/>
				</div>

				<div>
					<label className="mb-1 flex items-center justify-between text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
						<span>Code</span>
						<span className="font-normal lowercase">{lang}</span>
					</label>
					<textarea
						className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm leading-relaxed focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
						rows={12}
						spellCheck={false}
						value={code}
						onChange={(event): void => { setCode(event.target.value); }}
					/>
				</div>

				{error && (
					<p className="text-xs text-red-600 dark:text-red-400">{error}</p>
				)}
			</div>

			<div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-800">
				<button
					className="rounded-lg border border-gray-300 px-4 py-2 text-base font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
					type="button"
					onClick={onClose}
				>
					Cancel
				</button>
				<button
					className="rounded-lg bg-blue-600 px-4 py-2 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!canSave}
					type="submit"
				>
					{saving ? "Saving…" : "Save Answer"}
				</button>
			</div>
		</form>
	);
};

/**
 * Pop-out for saving the current code as a named answer. Prepopulates the code
 * from the editor but lets the user tweak it (plus add a name/note) before it's
 * written to history. The parent owns the actual mutation.
 */
export const SaveAnswerDialog = ({
	open,
	...formProps
}: SaveAnswerDialogProps): FunctionComponent => {
	return (
		<Dialog className="relative z-50" open={open} onClose={formProps.onClose}>
			<div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" />
			<div className="fixed inset-0 flex items-center justify-center p-4">
				<DialogPanel className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
					<SaveAnswerForm {...formProps} />
				</DialogPanel>
			</div>
		</Dialog>
	);
};
