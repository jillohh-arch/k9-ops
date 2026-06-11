import { HumanAdminForm } from "@/features/effective/components/human-admin-form";

export default async function EditHumanPage({
  params,
}: {
  params: Promise<{ ra: string }>;
}) {
  const { ra } = await params;
  return <HumanAdminForm mode="edit" ra={decodeURIComponent(ra)} />;
}
