import { PilotShell } from "@/components/pilot/PilotShell";
import "./pilot.css";
export default function PilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PilotShell>{children}</PilotShell>;
}
