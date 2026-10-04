import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AtRiskPanel, AttendancePanel } from "@/components/attendance-panels";
import { Shell } from "@/components/shell";
import { Seg } from "@/components/ui";

export const Route = createFileRoute("/manager/attendance")({ component: Page });

function Page() {
  const [tab, setTab] = useState("rate");
  return (
    <Shell
      role="manager"
      title="Attendance"
      subtitle="How often people actually turn up, and who needs a call before they drift away."
    >
      <div className="mb-4">
        <Seg
          value={tab}
          onChange={setTab}
          options={[
            { value: "rate", label: "Attendance rate" },
            { value: "risk", label: "At risk" },
          ]}
        />
      </div>
      {tab === "rate" ? <AttendancePanel canExport /> : <AtRiskPanel />}
    </Shell>
  );
}
