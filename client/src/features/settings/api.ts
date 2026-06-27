import type { SettingsView, UpdateSettingsBody } from "@shared";
import { apiFetch } from "@/services/api";

export function fetchSettings(): Promise<SettingsView> {
	return apiFetch<SettingsView>("/settings");
}

export function updateSettings(body: UpdateSettingsBody): Promise<SettingsView> {
	return apiFetch<SettingsView>("/settings", {
		method: "PATCH",
		body: JSON.stringify(body),
	});
}
