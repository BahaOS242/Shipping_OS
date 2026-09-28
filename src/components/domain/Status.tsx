import { CLAIM_COPY, CUSTOMS_COPY, DELIVERY_COPY, EXCEPTION_STATUS_COPY, INVOICE_ENGINE_COPY, PACKAGE_COPY, SEVERITY_COPY, SHIPMENT_COPY } from "@/domain/copy";
import { BILL_STATUS_COPY, RECON_COPY, type BillStatus, type ReconStatus } from "@/domain/billing";
import type { ClaimStatus, CustomsStatus, DeliveryStatus, ExceptionStatus, PackageStatus, PurchaseInvoiceStatus, Severity, ShipmentStatus } from "@/domain/types";
import { Pill } from "../ui/Pill";

type Size = "xs" | "sm" | "md" | "lg";

export const PackagePill = ({ status, staff, size }: { status: PackageStatus; staff?: boolean; size?: Size }) => {
  const c = PACKAGE_COPY[status];
  return <Pill tone={c.tone} icon={c.icon} size={size}>{staff ? c.staff : c.label}</Pill>;
};
export const ShipmentPill = ({ status, staff, size }: { status: ShipmentStatus; staff?: boolean; size?: Size }) => {
  const c = SHIPMENT_COPY[status];
  return <Pill tone={c.tone} icon={c.icon} size={size}>{staff ? c.label : c.customer}</Pill>;
};
export const CustomsPill = ({ status, size }: { status: CustomsStatus; size?: Size }) => <Pill tone={CUSTOMS_COPY[status].tone} icon={CUSTOMS_COPY[status].icon} size={size}>{CUSTOMS_COPY[status].label}</Pill>;
export const DeliveryPill = ({ status, staff, size }: { status: DeliveryStatus; staff?: boolean; size?: Size }) => {
  const c = DELIVERY_COPY[status];
  return <Pill tone={c.tone} icon={c.icon} size={size}>{staff ? c.label : c.customer}</Pill>;
};
export const BillPill = ({ status, size }: { status: BillStatus; size?: Size }) => {
  const c = BILL_STATUS_COPY[status];
  return <Pill tone={c.tone === "bad" ? "bad" : c.tone === "done" ? "done" : c.tone === "warn" ? "warn" : c.tone === "good" ? "good" : "neutral"} icon={c.icon} size={size}>{c.label}</Pill>;
};
export const ReconPill = ({ status, size }: { status: ReconStatus; size?: Size }) => <Pill tone={RECON_COPY[status].tone} icon={RECON_COPY[status].icon} size={size}>{RECON_COPY[status].label}</Pill>;
export const ExStatusPill = ({ status, size }: { status: ExceptionStatus; size?: Size }) => <Pill tone={EXCEPTION_STATUS_COPY[status].tone} icon={EXCEPTION_STATUS_COPY[status].icon} size={size}>{EXCEPTION_STATUS_COPY[status].label}</Pill>;
export const SeverityPill = ({ severity, size }: { severity: Severity; size?: Size }) => <Pill tone={SEVERITY_COPY[severity].tone} icon={SEVERITY_COPY[severity].icon} size={size}>{SEVERITY_COPY[severity].label}</Pill>;
export const ClaimPill = ({ status, size }: { status: ClaimStatus; size?: Size }) => <Pill tone={CLAIM_COPY[status].tone} icon={CLAIM_COPY[status].icon} size={size}>{CLAIM_COPY[status].label}</Pill>;
export const ReceiptPill = ({ status, customer, size }: { status: PurchaseInvoiceStatus; customer?: boolean; size?: Size }) => {
  const c = INVOICE_ENGINE_COPY[status];
  return <Pill tone={c.tone} icon={c.icon} size={size}>{customer ? c.customer : c.label}</Pill>;
};
