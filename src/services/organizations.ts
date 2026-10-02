/**
 * ORGANIZATIONS — onboarding, entitlements, branding, members and imports.
 *
 * Creating an organization is self-service (the creator becomes its Owner).
 * Everything after that runs inside the organization and needs `org.manage`.
 */
import { nowIso } from "@/data/clock";
import { destinations as islandTemplates, forOrg } from "@/data/reference";
import { db, emptyTenant, mutate, mutatePlatform, nextSeq, platform, withTenant } from "@/data/store";
import { can } from "@/domain/roles";
import type { Actor, DestinationId, ID, Location, Organization, StaffUser } from "@/domain/types";
import { emit } from "@/events/bus";
import { BUSINESS_TYPES, isBusinessType, presetModules, type BusinessType } from "@/platform/businessTypes";
import { WIDGET_IDS, widgetAvailable, type WidgetId } from "@/platform/dashboard";
import { InvalidModuleError, MODULES, isModuleId, resolveModules, toggleModule, validateModules, type ModuleId } from "@/platform/modules";
import { BusinessError } from "./_shared";
import { authorize, currentOrganization, getOrganization } from "./access";
import { createCustomer } from "./customers";
import { createPort, createVessel } from "./network";

export const DEFAULT_ORG_ID = "org_shipping_os";

export const listOrganizations = () => platform().organizations;
/** Which organization owns an inbound WhatsApp business number. */
export const organizationForWhatsAppNumber = (phoneNumberId: string) => platform().organizations.find((o) => o.channels?.whatsappPhoneNumberId === phoneNumberId);

export const getOrganizationBySlug = (slug: string) => platform().organizations.find((o) => o.slug === slug.trim().toLowerCase());
export { currentOrganization, getOrganization };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export type OnboardingLocation = { name: string; kind: Location["kind"]; island?: DestinationId; address: string; hours?: string; phone?: string };

export type CreateOrganizationInput = {
  name: string;
  slug?: string;
  businessType: BusinessType;
  /** Explicit module selection (Custom, or a preset the admin edited). Defaults to the business type's preset. */
  modules?: string[];
  branding?: Partial<Organization["branding"]>;
  contact?: Organization["contact"];
  locations?: OnboardingLocation[];
  owner: { name: string; email: string };
};

/** Step 1–3 of onboarding in one transaction: organization, entitlements, owner, data partition. */
export function createOrganization(input: CreateOrganizationInput) {
  const name = input.name?.trim();
  if (!name) throw new BusinessError("Enter the business name.");
  if (!isBusinessType(input.businessType)) throw new BusinessError("Choose a business type.");
  const slug = (input.slug?.trim() || slugify(name)).toLowerCase();
  if (!SLUG_RE.test(slug)) throw new BusinessError("The short name can use lowercase letters, numbers and dashes.");
  if (getOrganizationBySlug(slug)) throw new BusinessError(`"${slug}" is already taken.`);
  if (!input.owner?.name?.trim() || !/^\S+@\S+\.\S+$/.test(input.owner.email ?? "")) throw new BusinessError("Enter the owner's name and email.");
  let modules: ModuleId[];
  try {
    modules = input.modules ? resolveModules(input.modules) : presetModules(input.businessType);
  } catch (e) {
    throw new BusinessError((e as InvalidModuleError).message);
  }

  return mutatePlatform((p) => {
    const id = `org_${slug.replace(/-/g, "_")}`;
    const org: Organization = {
      id,
      slug,
      name,
      businessType: input.businessType,
      status: "active",
      modules,
      branding: { primaryColor: input.branding?.primaryColor || "#0a7f8b", logoText: input.branding?.logoText?.trim() || name, logoUrl: input.branding?.logoUrl, tagline: input.branding?.tagline },
      contact: input.contact ?? {},
      createdAt: nowIso(),
    };
    p.organizations.push(org);
    const t = emptyTenant(id);
    t.destinations = forOrg(id, islandTemplates).map((d) => ({ ...d, pickupLocationIds: [] }));
    t.locations = (input.locations ?? [])
      .filter((l) => l.name.trim())
      .map((l) => ({ id: `loc_${nextSeq("loc", 100)}`, organizationId: id, kind: l.kind, name: l.name.trim(), purpose: l.kind === "us_warehouse" ? "Receiving warehouse" : "Pickup location", destinationId: l.island, addressLines: [l.address.trim()], hours: l.hours ?? "", phone: l.phone }));
    for (const l of t.locations) if (l.destinationId) t.destinations.find((d) => d.id === l.destinationId)?.pickupLocationIds.push(l.id);
    const owner: StaffUser = { id: `stf_${nextSeq("stf", 100)}`, organizationId: id, name: input.owner.name.trim(), email: input.owner.email.trim(), role: "owner", title: "Owner", status: "active" };
    t.staff.push(owner);
    p.tenants[id] = t;
    withTenant(id, () =>
      emit("ORGANIZATION_CREATED", {
        actor: { kind: "staff", name: owner.name, role: "owner", organizationId: id, userId: owner.id },
        refs: {},
        summary: `${name} created as ${BUSINESS_TYPES[input.businessType].label} with ${modules.length} modules`,
        data: { modules },
      }),
    );
    return { organization: org, owner };
  });
}

/** Org-admin guard: member of this organization, with `org.manage`. */
function orgAdmin(actor: Actor) {
  authorize(actor, null, can(actor, "org.manage"), "Only an owner or admin can change organization settings.");
  return currentOrganization();
}

export function updateOrganizationProfile(actor: Actor, patch: { name?: string; branding?: Partial<Organization["branding"]>; contact?: Organization["contact"]; channels?: Organization["channels"] }) {
  const org = orgAdmin(actor);
  const wa = patch.channels?.whatsappPhoneNumberId;
  if (wa && platform().organizations.some((o) => o.id !== org.id && o.channels?.whatsappPhoneNumberId === wa)) throw new BusinessError("That WhatsApp number belongs to another organization.");
  if (patch.name !== undefined && !patch.name.trim()) throw new BusinessError("The business name can't be empty.");
  if (patch.branding?.primaryColor && !/^#[0-9a-f]{6}$/i.test(patch.branding.primaryColor)) throw new BusinessError("Use a hex color like #0a7f8b.");
  return mutatePlatform(() => {
    if (patch.name) org.name = patch.name.trim();
    if (patch.branding) org.branding = { ...org.branding, ...patch.branding };
    if (patch.contact) org.contact = { ...org.contact, ...patch.contact };
    if (patch.channels) org.channels = { ...org.channels, ...patch.channels };
    emit("ORGANIZATION_UPDATED", { actor, refs: {}, summary: "Organization profile updated" });
    return org;
  });
}

function saveModules(actor: Actor, org: Organization, next: ModuleId[]) {
  const problems = validateModules(next); // invariant: stored configurations are always dependency-complete
  if (problems.length) throw new BusinessError(problems.join(" "));
  const before = new Set(org.modules);
  const added = next.filter((m) => !before.has(m));
  const removed = org.modules.filter((m) => !next.includes(m));
  return mutatePlatform(() => {
    org.modules = next;
    if (added.length || removed.length) {
      emit("MODULES_UPDATED", {
        actor,
        refs: {},
        summary: `Modules updated${added.length ? ` · on: ${added.map((m) => MODULES[m].label).join(", ")}` : ""}${removed.length ? ` · off: ${removed.map((m) => MODULES[m].label).join(", ")}` : ""}`,
        data: { added, removed },
      });
    }
    return { modules: next, added, removed };
  });
}

/**
 * Replace the module list. Unknown modules are always rejected. By default
 * dependencies are added automatically; `strict` rejects a list that is missing
 * any (for API clients that must state the exact configuration).
 */
export function setModules(actor: Actor, modules: string[], opts: { strict?: boolean } = {}) {
  const org = orgAdmin(actor);
  const bad = modules.find((m) => !isModuleId(m));
  if (bad) throw new BusinessError(`Unknown module "${bad}".`);
  if (opts.strict) {
    const problems = validateModules(modules);
    if (problems.length) throw new BusinessError(problems.join(" "));
  }
  return saveModules(actor, org, resolveModules(modules));
}

/** Turn one module on (adds its dependencies) or off (also turns off what depends on it). */
export function setModuleEnabled(actor: Actor, module: ModuleId, enabled: boolean) {
  const org = orgAdmin(actor);
  if (!isModuleId(module)) throw new BusinessError(`Unknown module "${module}".`);
  return saveModules(actor, org, toggleModule(org.modules, module, enabled));
}

/** Switch business type and start again from its preset. */
export function applyBusinessType(actor: Actor, businessType: BusinessType) {
  const org = orgAdmin(actor);
  if (!isBusinessType(businessType)) throw new BusinessError("Choose a business type.");
  mutatePlatform(() => (org.businessType = businessType));
  return saveModules(actor, org, presetModules(businessType));
}

/* ---------------- Dashboard ---------------- */

/** The overview widgets for an organization: its emphasis order, filtered by enabled modules. */
export function dashboardFor(org: Organization = currentOrganization()): WidgetId[] {
  const order = org.dashboard ?? BUSINESS_TYPES[org.businessType].dashboard;
  return order.filter((w) => WIDGET_IDS.includes(w) && widgetAvailable(w, org.modules));
}

/* ---------------- Members ---------------- */

export const listMembers = () => db().staff;

export function inviteUser(actor: Actor, input: { name: string; email: string; role: StaffUser["role"]; title?: string }) {
  orgAdmin(actor);
  if (!input.name.trim()) throw new BusinessError("Enter a name.");
  if (!/^\S+@\S+\.\S+$/.test(input.email)) throw new BusinessError("Enter a valid email.");
  if ((input.role as string) === "customer") throw new BusinessError("Customers sign up through the customer portal.");
  if (input.role === "owner" && actor.role !== "owner") throw new BusinessError("Only an owner can invite another owner.");
  if (db().staff.some((u) => u.email?.toLowerCase() === input.email.trim().toLowerCase())) throw new BusinessError("That person is already a member.");
  return mutate((s) => {
    const u: StaffUser = { id: `stf_${nextSeq("stf", 100)}`, organizationId: s.organizationId, name: input.name.trim(), email: input.email.trim(), role: input.role, title: input.title?.trim() || input.role, status: "invited" };
    s.staff.push(u);
    emit("USER_INVITED", { actor, refs: {}, summary: `${u.name} invited as ${u.role}` });
    return u;
  });
}

/** The invitee accepts (demo: no email round-trip). Invited members can't act until they do. */
export function acceptInvite(userId: ID) {
  return mutate((s) => {
    const u = s.staff.find((x) => x.id === userId);
    if (!u) throw new BusinessError("Invitation not found.");
    u.status = "active";
    return u;
  });
}

/* ---------------- Initial data (basic CSV import) ---------------- */

/** Minimal CSV parser: header row, comma-separated, double-quoted fields. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") endCell();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endCell();
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) {
    endCell();
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

export const IMPORT_KINDS = {
  customers: { label: "Customers", columns: ["firstName", "lastName", "email", "phone", "island", "businessName"], module: "customers" as ModuleId },
  vessels: { label: "Vessels", columns: ["name", "kind", "capacityLb", "registration"], module: "vessels" as ModuleId },
  ports: { label: "Ports", columns: ["code", "name", "kind", "island"], module: "routes" as ModuleId },
} as const;
export type ImportKind = keyof typeof IMPORT_KINDS;

/** Import rows one by one through the normal services (same validation and authorization). */
export function importCsv(actor: Actor, kind: ImportKind, text: string) {
  orgAdmin(actor);
  const spec = IMPORT_KINDS[kind];
  if (!spec) throw new BusinessError("Unknown import type.");
  if (!currentOrganization().modules.includes(spec.module)) throw new BusinessError(`Turn on ${MODULES[spec.module].label} first.`);
  const rows = parseCsv(text);
  if (!rows.length) throw new BusinessError("The file has no rows.");
  const errors: string[] = [];
  let created = 0;
  rows.forEach((r, i) => {
    try {
      if (kind === "customers") createCustomer(actor, { firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone, homeDestination: (r.island || undefined) as DestinationId | undefined, businessName: r.businessName || undefined });
      else if (kind === "vessels") createVessel(actor, { name: r.name, kind: (r.kind || "cargo_vessel") as never, capacityLb: Number(r.capacityLb), registration: r.registration || undefined });
      else createPort(actor, { code: r.code, name: r.name, kind: (r.kind || "dock") as never, destinationId: (r.island || undefined) as DestinationId | undefined });
      created++;
    } catch (e) {
      errors.push(`Row ${i + 2}: ${(e as Error).message}`);
    }
  });
  mutatePlatform(() => emit("DATA_IMPORTED", { actor, refs: {}, summary: `Imported ${created} ${spec.label.toLowerCase()}${errors.length ? ` (${errors.length} skipped)` : ""}` }));
  return { created, errors };
}

/** Sign-in helper for the demo: the owner of an organization as an Actor. */
export function ownerOf(organizationId: ID): Actor {
  const u = platform().tenants[organizationId]?.staff.find((x) => x.role === "owner");
  if (!u) throw new BusinessError("That organization has no owner.");
  return { kind: "staff", name: u.name, role: u.role, organizationId, userId: u.id };
}
