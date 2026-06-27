import {
	useMutation,
	type UseMutationResult,
	useQuery,
	useQueryClient,
	type UseQueryResult,
} from "@tanstack/react-query";
import type { SettingsView, UpdateSettingsBody } from "@shared";
import { fetchSettings, updateSettings } from "./api";

/** The current masked settings view. */
export function useSettingsQuery(): UseQueryResult<SettingsView, Error> {
	return useQuery({
		queryKey: ["settings"],
		queryFn: () => fetchSettings(),
		retry: false,
	});
}

/** Apply a partial settings update; refreshes the cached view on success. */
export function useUpdateSettingsMutation(): UseMutationResult<
	SettingsView,
	Error,
	UpdateSettingsBody
> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdateSettingsBody) => updateSettings(body),
		retry: false,
		onSuccess: (data) => {
			queryClient.setQueryData(["settings"], data);
		},
	});
}
