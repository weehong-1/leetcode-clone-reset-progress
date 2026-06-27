import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { SecretView, UpdateSettingsBody } from "@shared";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { FunctionComponent } from "@/common/types";
import {
	useSettingsQuery,
	useUpdateSettingsMutation,
} from "@/features/settings/queries";

function SourceBadge({ view }: { view: SecretView }): FunctionComponent {
	const label =
		view.source === "database"
			? "Saved"
			: view.source === "env"
				? "From .env"
				: "Not set";
	const tone =
		view.source === "none"
			? "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
			: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
	return (
		<span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>
			{label}
			{view.set && view.masked ? ` · ${view.masked}` : ""}
		</span>
	);
}

interface SecretFieldProps {
	label: string;
	hint: string;
	view: SecretView;
	value: string;
	onChange: (value: string) => void;
	onClear: () => void;
	clearing: boolean;
}

function SecretField({
	label,
	hint,
	view,
	value,
	onChange,
	onClear,
	clearing,
}: SecretFieldProps): FunctionComponent {
	return (
		<div className="space-y-1.5">
			<div className="flex items-center gap-2">
				<label className="text-base font-medium text-gray-800 dark:text-gray-200">
					{label}
				</label>
				<SourceBadge view={view} />
				{view.source === "database" && (
					<button
						className="ml-auto text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
						disabled={clearing}
						type="button"
						onClick={onClear}
					>
						{clearing ? "Clearing…" : "Clear saved value"}
					</button>
				)}
			</div>
			<input
				autoComplete="off"
				className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-600"
				placeholder={view.set ? "Leave blank to keep current" : "Not set"}
				type="password"
				value={value}
				onChange={(event): void => { onChange(event.target.value); }}
			/>
			<p className="text-sm text-gray-500 dark:text-gray-500">{hint}</p>
		</div>
	);
}

interface TextFieldProps {
	label: string;
	hint: string;
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
}

function TextField({
	label,
	hint,
	value,
	placeholder,
	onChange,
}: TextFieldProps): FunctionComponent {
	return (
		<div className="space-y-1.5">
			<label className="block text-base font-medium text-gray-800 dark:text-gray-200">
				{label}
			</label>
			<input
				className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-600"
				placeholder={placeholder}
				type="text"
				value={value}
				onChange={(event): void => { onChange(event.target.value); }}
			/>
			<p className="text-sm text-gray-500 dark:text-gray-500">{hint}</p>
		</div>
	);
}

/** Settings page — provide OpenAI + LeetCode secrets without editing .env. */
export const Settings = (): FunctionComponent => {
	const query = useSettingsQuery();
	const mutation = useUpdateSettingsMutation();

	// Secret drafts: "" means "untouched / keep current".
	const [openaiApiKey, setOpenaiApiKey] = useState("");
	const [leetcodeSession, setLeetcodeSession] = useState("");
	const [csrfToken, setCsrfToken] = useState("");
	// Non-secret drafts: null means "follow the saved value".
	const [baseUrlDraft, setBaseUrlDraft] = useState<string | null>(null);
	const [modelDraft, setModelDraft] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	if (query.isPending) {
		return (
			<div className="flex min-h-screen items-center justify-center text-gray-400 dark:text-gray-500">
				Loading settings…
			</div>
		);
	}
	if (query.isError) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
				<p className="text-red-600 dark:text-red-400">{query.error.message}</p>
				<Link className="text-base text-blue-600 underline dark:text-blue-400" to="/">
					Back to problems
				</Link>
			</div>
		);
	}

	const view = query.data;
	const baseUrl = baseUrlDraft ?? view.openai.baseUrl;
	const model = modelDraft ?? view.openai.model;

	const resetDrafts = (): void => {
		setOpenaiApiKey("");
		setLeetcodeSession("");
		setCsrfToken("");
		setBaseUrlDraft(null);
		setModelDraft(null);
	};

	const onSave = (): void => {
		const patch: UpdateSettingsBody = {};
		if (openaiApiKey !== "") patch.openaiApiKey = openaiApiKey;
		if (leetcodeSession !== "") patch.leetcodeSession = leetcodeSession;
		if (csrfToken !== "") patch.csrfToken = csrfToken;
		if (baseUrlDraft !== null && baseUrlDraft !== view.openai.baseUrl) {
			patch.openaiBaseUrl = baseUrlDraft;
		}
		if (modelDraft !== null && modelDraft !== view.openai.model) {
			patch.openaiModel = modelDraft;
		}
		if (Object.keys(patch).length === 0) return;
		setSaved(false);
		mutation.mutate(patch, {
			onSuccess: () => {
				resetDrafts();
				setSaved(true);
			},
		});
	};

	const clear = (field: keyof UpdateSettingsBody): void => {
		setSaved(false);
		mutation.mutate({ [field]: "" });
	};

	const dirty =
		openaiApiKey !== "" ||
		leetcodeSession !== "" ||
		csrfToken !== "" ||
		(baseUrlDraft !== null && baseUrlDraft !== view.openai.baseUrl) ||
		(modelDraft !== null && modelDraft !== view.openai.model);

	return (
		<div className="min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-950">
			<div className="absolute right-4 top-4 z-30">
				<ThemeToggle showLabels={false} />
			</div>

			<div className="mx-auto w-full max-w-2xl">
				<Link
					className="text-base text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
					to="/"
				>
					← Problems
				</Link>
				<h1 className="mb-1 mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
					Settings
				</h1>
				<p className="mb-8 text-base text-gray-500 dark:text-gray-400">
					Secrets are stored locally and override your environment variables.
					Saved values take effect immediately — no restart needed.
				</p>

				<section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
					<h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
						AI Provider
					</h2>
					<div className="space-y-5">
						<SecretField
							clearing={mutation.isPending}
							hint="OpenRouter or DeepSeek API key, used by the tutor and complexity checker."
							label="API key"
							value={openaiApiKey}
							view={view.openai.apiKey}
							onChange={setOpenaiApiKey}
							onClear={(): void => { clear("openaiApiKey"); }}
						/>
						<TextField
							hint="API base URL, e.g. https://openrouter.ai/api/v1"
							label="Base URL"
							placeholder="https://openrouter.ai/api/v1"
							value={baseUrl}
							onChange={setBaseUrlDraft}
						/>
						<TextField
							hint="Model id, e.g. deepseek/deepseek-chat"
							label="Model"
							placeholder="deepseek/deepseek-chat"
							value={model}
							onChange={setModelDraft}
						/>
					</div>
				</section>

				<section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
					<h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
						LeetCode Account
					</h2>
					<p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
						Required to run and submit code against your real LeetCode account.
					</p>
					<div className="space-y-5">
						<SecretField
							clearing={mutation.isPending}
							hint="The LEETCODE_SESSION cookie from your logged-in browser."
							label="Session cookie"
							value={leetcodeSession}
							view={view.leetcode.session}
							onChange={setLeetcodeSession}
							onClear={(): void => { clear("leetcodeSession"); }}
						/>
						<SecretField
							clearing={mutation.isPending}
							hint="The csrftoken cookie that pairs with your session."
							label="CSRF token"
							value={csrfToken}
							view={view.leetcode.csrf}
							onChange={setCsrfToken}
							onClear={(): void => { clear("csrfToken"); }}
						/>
					</div>
				</section>

				<div className="flex items-center gap-3">
					<button
						className="rounded-lg bg-green-500 px-5 py-2.5 text-base font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!dirty || mutation.isPending}
						type="button"
						onClick={onSave}
					>
						{mutation.isPending ? "Saving…" : "Save changes"}
					</button>
					{saved && !mutation.isPending && (
						<span className="flex items-center gap-1 text-base text-green-600 dark:text-green-400">
							<CheckCircleIcon className="h-5 w-5" />
							Saved
						</span>
					)}
					{mutation.isError && (
						<span className="text-base text-red-600 dark:text-red-400">
							{mutation.error.message}
						</span>
					)}
				</div>
			</div>
		</div>
	);
};
