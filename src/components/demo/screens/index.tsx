"use client";

/** Screen registry: every screen kind → its component and the element it spotlights by default. */
import type { ScreenConfig, ScreenData, ScreenKind } from "@/demo/types";
import { AiScreen } from "./AiScreen";
import { BillingScreen, FlowScreen, GroupingScreen, StorageScreen } from "./Business";
import { PortalScreen, TimelineScreen } from "./Customer";
import { DispatchScreen, DriverScreen, PodScreen } from "./Delivery";
import { BookingsScreen, CapacityScreen, VesselScreen } from "./Network";
import { DashboardScreen, ManifestScreen, ReceiveScreen, ScheduleScreen } from "./Operations";

type ScreenDef<K extends ScreenKind> = { Component: (p: { data: ScreenData[K] }) => React.ReactNode; target: string };

export const SCREENS: { [K in ScreenKind]: ScreenDef<K> } = {
  dashboard: { Component: DashboardScreen, target: "alert-0" },
  receive: { Component: ReceiveScreen, target: "receive-btn" },
  manifest: { Component: ManifestScreen, target: "build-btn" },
  timeline: { Component: TimelineScreen, target: "advance-btn" },
  portal: { Component: PortalScreen, target: "whatsapp-btn" },
  ai: { Component: AiScreen, target: "ask-btn" },
  vessel: { Component: VesselScreen, target: "checklist" },
  bookings: { Component: BookingsScreen, target: "open-booking" },
  capacity: { Component: CapacityScreen, target: "requests" },
  dispatch: { Component: DispatchScreen, target: "assign" },
  driver: { Component: DriverScreen, target: "start-btn" },
  pod: { Component: PodScreen, target: "pod-form" },
  storage: { Component: StorageScreen, target: "auto-bin" },
  grouping: { Component: GroupingScreen, target: "create-btn" },
  schedule: { Component: ScheduleScreen, target: "depart-btn" },
  flow: { Component: FlowScreen, target: "run-btn" },
  billing: { Component: BillingScreen, target: "issue-btn" },
};

function render<K extends ScreenKind>(c: { kind: K; data: ScreenData[K] }) {
  const { Component } = SCREENS[c.kind];
  return <Component data={c.data} />;
}

export function Screen({ config }: { config: ScreenConfig }) {
  return render(config);
}

export const defaultTarget = (config: ScreenConfig) => SCREENS[config.kind].target;
