import { BinomialAdminForm } from "@/features/effective/components/binomial-admin-form";

export default async function EditBinomialPage({
  params,
}: {
  params: Promise<{ binomialId: string }>;
}) {
  const { binomialId } = await params;
  return (
    <BinomialAdminForm
      binomialId={decodeURIComponent(binomialId)}
      mode="edit"
    />
  );
}
