import { AgentPlayground } from "../../playground";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default async function TaskDetailPage({ params }: { params: { taskId: string } }) {
  return <AgentPlayground apiBaseUrl={apiBaseUrl} embedded initialTaskId={params.taskId} />;
}
