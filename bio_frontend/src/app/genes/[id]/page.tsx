export const dynamic = "force-dynamic";

import GeneDetailClient from "./GeneDetailClient";

export default async function GeneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GeneDetailClient id={id} />;
}
