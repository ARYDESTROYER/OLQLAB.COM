import AssessmentDetailClient from "./AssessmentDetailClient";

export default async function AdminAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssessmentDetailClient assessmentId={id} />;
}
