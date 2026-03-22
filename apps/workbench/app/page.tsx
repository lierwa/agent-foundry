import { AgentPlayground } from "./playground";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function HomePage() {
  return <AgentPlayground apiBaseUrl={apiBaseUrl} />;
}
