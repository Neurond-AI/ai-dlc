import { TaskDetailView } from "@/components/task/task-detail-view";

interface TaskDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params;
  return <TaskDetailView taskId={id} />;
}
