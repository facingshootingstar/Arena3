import { createFileRoute } from "@tanstack/react-router";
import { AtRiskPanel } from "@/components/attendance-panels";
import { Shell, useSessionUser } from "@/components/shell";

export const Route = createFileRoute("/desk/at-risk")({ component: Page });

function Page() {
  const user = useSessionUser();
  return (
    <Shell
      role={user?.role === "manager" ? "manager" : "receptionist"}
      title="At risk"
      subtitle="Members who may be drifting away. A friendly call now is cheaper than a lapsed plan."
    >
      <AtRiskPanel />
    </Shell>
  );
}
