import { PilotShell } from "@/components/pilot/PilotShell";
import "./pilot.css";
import "./island-theme.css";
import { PilotAppearance } from "@/components/pilot/PilotAppearance";
export default function PilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PilotAppearance>
      <PilotShell>{children}</PilotShell>
    </PilotAppearance>
  );
}
