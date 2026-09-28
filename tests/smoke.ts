import "@/services";
import { db } from "@/data/store";
import * as svc from "@/services";

const s = db();
const count = (k: keyof typeof s) => (Array.isArray(s[k]) ? (s[k] as unknown[]).length : "-");
console.log(Object.fromEntries(["customers","packages","shipments","purchaseInvoices","bills","payments","exceptions","deliveries","claims","tickets","conversations","notifications","events","procurements","voyages"].map((k) => [k, count(k as keyof typeof s)])));
console.log("exceptions:", s.exceptions.map((e) => `${e.id} ${e.type} ${e.status} ${e.packageId ?? e.shipmentId ?? e.billId ?? ""}`));
console.log("shipments:", s.shipments.map((x) => `${x.id} ${x.customerId} ${x.status} customs=${x.customs.status}`));
console.log("recon:", svc.reconciliationRows().filter((r) => r.status !== "matched").map((r) => `${r.billId ?? r.paymentIds[0]} ${r.status} ${r.reason}`));
console.log("trevor:", svc.listPackages({ customerId: "cus_trevor" }).map((p) => `${p.id} ${p.merchant} ${p.status}`), svc.customerBalance("cus_trevor").balance);
console.log("ops:", svc.operationsSnapshot());
