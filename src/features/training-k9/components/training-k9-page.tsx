"use client";

import { Suspense } from "react";

import { useTrainingK9Data } from "../hooks/use-training-k9-data";
import { EvaluationsProvider } from "../hooks/use-evaluations-data";
import { TrainingSessionsProvider } from "../hooks/use-training-sessions-data";

import { DogsTab } from "./dogs-tab";
import { EvaluationsTab } from "./evaluations-tab";
import { OverviewTab } from "./overview-tab";
import { SessionsTab } from "./sessions-tab";
import { TrainingK9Header } from "./training-k9-header";
import {
  TabPlaceholder,
  TrainingK9Error,
  TrainingK9Skeleton,
} from "./training-k9-shell";
import { TrainingK9Tabs, useActiveTab } from "./training-k9-tabs";

function TrainingK9Content() {
  const [activeTab, setTab] = useActiveTab();
  const data = useTrainingK9Data();

  const pendingEvaluations = data.metrics.pendingPromotions;

  return (
    <div className="space-y-6">
      <TrainingK9Header />

      <TrainingK9Tabs
        activeTab={activeTab}
        onTabChange={setTab}
        pendingEvaluations={pendingEvaluations}
      />

      {data.loading ? (
        <TrainingK9Skeleton />
      ) : data.errors.length > 0 ? (
        <TrainingK9Error errors={data.errors} />
      ) : (
        <div role="tabpanel">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "dogs" && <DogsTab />}
          {activeTab === "sessions" && (
            <TrainingSessionsProvider>
              <SessionsTab />
            </TrainingSessionsProvider>
          )}
          {activeTab === "evaluations" && (
            <EvaluationsProvider>
              <EvaluationsTab />
            </EvaluationsProvider>
          )}
          {activeTab === "reports" && (
            <TabPlaceholder tabLabel="Relatórios" />
          )}
        </div>
      )}
    </div>
  );
}

export function TrainingK9Page() {
  return (
    <Suspense fallback={<TrainingK9Skeleton />}>
      <TrainingK9Content />
    </Suspense>
  );
}
