import { apiFetch } from "@/lib/api-client";
import type { AdminOverview } from "@/types/admin";

type AdminOverviewResponse = {
  success: boolean;
  data: AdminOverview;
};

export async function fetchAdminOverview(token: string) {
  const response = await apiFetch<AdminOverviewResponse>("/api/admin/overview", {
    token,
  });

  return response.data;
}
