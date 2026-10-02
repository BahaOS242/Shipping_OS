"use client";

import type { ReactNode } from "react";
import type { ModuleId } from "@/domain/modules";
import { hasModule } from "@/services/tenant";

export function ModuleGate({
  module,
  children,
  fallback = null,
}: {
  module: ModuleId;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return hasModule(module) ? children : fallback;
}
