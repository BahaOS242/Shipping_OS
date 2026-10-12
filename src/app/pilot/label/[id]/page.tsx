import { withOperator } from "@/server/pilot";
import { sessionToken } from "@/server/pilot-http";
import { id } from "@/server/operations";
import QRCode from "qrcode";
import { PrintButton } from "@/components/pilot/PrintButton";
export const dynamic = "force-dynamic";
export default async function Label({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let p;
  let qr = "";
  try {
    const packageId = id((await params).id);
    p = await withOperator(
      await sessionToken(),
      async (db, s) =>
        (
          await db.query(
            "SELECT p.*,c.display_name,o.name AS organization FROM packages p JOIN customers c ON c.organization_id=p.organization_id AND c.id=p.customer_id JOIN organizations o ON o.id=p.organization_id WHERE p.organization_id=$1 AND p.id=$2",
            [s.organization_id, packageId],
          )
        ).rows[0],
    );
    if (p) qr = await QRCode.toString(p.id, { type: "svg", width: 180 });
  } catch {
    p = undefined;
  }
  if (!p)
    return (
      <p className="p-8">Sign in as staff and select an existing package.</p>
    );
  return (
    <main className="mx-auto max-w-md p-8 text-black">
      <PrintButton />
      <section className="mt-6 rounded border-2 border-black p-6">
        <h1 className="text-2xl font-bold">{p.organization}</h1>
        <p className="mt-4 text-xl">{p.display_name}</p>
        <p className="mt-2 font-semibold">
          {p.destination || "Destination pending"} · {p.service}
        </p>
        <p className="mt-2">
          Bin: {p.bin || "Not assigned"} · {p.weight_kg ?? "—"} kg
        </p>
        <div className="my-4" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="break-all font-mono">{p.tracking_number}</p>
        <p className="mt-2 break-all text-xs">{p.id}</p>
      </section>
    </main>
  );
}
