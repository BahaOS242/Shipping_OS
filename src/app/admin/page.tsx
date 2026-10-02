"use client";

import { useLive } from "@/data/useLive";
import { WIDGET_COMPONENTS } from "@/components/ops/DashboardWidgets";
import { OpsPage } from "@/components/ops/OpsPage";
import { BUSINESS_TYPES } from "@/platform/businessTypes";
import * as svc from "@/services";

/**
 * Operations overview — assembled from widgets in the order the organization's
 * configuration emphasizes, filtered by its enabled modules.
 */
export default function AdminPage() {
  useLive();
  const org = svc.currentOrganization();
  const widgets = svc.dashboardFor(org);
  return (
    <OpsPage
      title={`${org.name} — overview`}
      sub={`${BUSINESS_TYPES[org.businessType].label} · everything that needs attention, derived live from the same records every team uses.`}
      eyebrow={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${svc.currentActor().name.split(" ")[0]}`}
    >
      {widgets.map((id) => {
        const W = WIDGET_COMPONENTS[id];
        return <W key={id} />;
      })}
    </OpsPage>
  );
}
