"use client";

import { Header } from "@/components/Header";
import { DynamicTextEditor } from "@/components/TextEditor/DynamicTextEditor";
import { WorkflowCanvas } from "@/components/WorkflowCanvas/WorkflowCanvas";

export default function Page() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="shrink-0">
        <Header />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full">
          <div className="flex h-full items-stretch overflow-hidden">
            <div className="w-[600px] shrink-0 h-full overflow-y-auto">
              <DynamicTextEditor conflictHighlight={null} />
            </div>

            <div className="flex-1 min-w-0 overflow-hidden h-full">
              <WorkflowCanvas />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
