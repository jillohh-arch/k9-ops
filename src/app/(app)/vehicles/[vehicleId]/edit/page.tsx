import { VehicleAdminForm } from "@/features/effective/components/vehicle-admin-form";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  return (
    <VehicleAdminForm
      mode="edit"
      vehicleId={decodeURIComponent(vehicleId)}
    />
  );
}
