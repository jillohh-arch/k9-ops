import { HumanEditV1 } from "@/features/effective/components/human-edit-v1/human-edit-v1";

export default async function EditHumanPage({
  params,
}: {
  params: Promise<{ ra: string }>;
}) {
  const { ra } = await params;
  // Human Edit V1: Personnel-only experience. The legacy HumanAdminForm still
  // serves mode="create" and transitional flows and is intentionally left
  // untouched. Permission gating + zero-load-without-humans.edit live inside
  // HumanEditV1 (frozen C2/R1); this route only hands off the RA identity.
  return <HumanEditV1 ra={decodeURIComponent(ra)} />;
}
