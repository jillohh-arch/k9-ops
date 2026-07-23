import { K9OpsLoadingScreen } from "@/components/feedback/k9-ops-loading-screen";

export default function Loading() {
  return <K9OpsLoadingScreen stage="syncingModules" progress={0.95} />;
}
