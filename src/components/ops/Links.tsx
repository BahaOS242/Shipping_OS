import Link from "next/link";
import * as svc from "@/services";

const cls = "font-semibold text-sea-700 underline decoration-sea-200 underline-offset-2 hover:decoration-sea-700";

export const CustomerLink = ({ id }: { id?: string }) => {
  const c = svc.findCustomer(id);
  return c ? <Link className={cls} href={`/customers/${c.id}`}>{svc.customerName(c)}</Link> : <span className="font-semibold text-coral-700">Unmatched</span>;
};
export const PackageLink = ({ id }: { id?: string }) => (id ? <Link className={`${cls} font-mono`} href={`/warehouse/packages/${id}`}>{id}</Link> : <span>—</span>);
export const ShipmentLink = ({ id }: { id?: string }) => (id ? <Link className={`${cls} font-mono`} href={`/customs/${id}`}>{id}</Link> : <span>—</span>);
export const BillLink = ({ id }: { id?: string }) => (id ? <Link className={`${cls} font-mono`} href={`/accounting/bills/${id}`}>{id}</Link> : <span>—</span>);
export const ReceiptLink = ({ id }: { id?: string }) => (id ? <Link className={`${cls} font-mono`} href={`/accounting/invoices/${id}`}>{id}</Link> : <span>—</span>);
