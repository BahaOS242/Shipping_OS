import {
  DEFAULT_MODULES,
  MODULE_CATALOG,
  ORGANIZATION_PRESETS,
  normalizeModules,
  type ModuleId,
  type Organization,
  type OrganizationType,
} from "@/domain/modules";
import { db, mutate } from "@/data/store";

export function currentOrganization(): Organization {
  return db().organization;
}

export function hasModule(module: ModuleId): boolean {
  return currentOrganization().enabledModules.includes(module);
}

export function enabledModules(): ModuleId[] {
  return [...currentOrganization().enabledModules];
}

export function moduleCatalog() {
  return MODULE_CATALOG;
}

export function configureOrganization(input: {
  name: string;
  type: OrganizationType;
  modules?: ModuleId[];
  slug?: string;
  theme?: Organization["theme"];
}): Organization {
  const modules = normalizeModules(
    input.modules?.length ? input.modules : ORGANIZATION_PRESETS[input.type] ?? DEFAULT_MODULES,
  );

  return mutate((s) => {
    s.organization = {
      ...s.organization,
      name: input.name.trim() || s.organization.name,
      slug: input.slug?.trim() || s.organization.slug,
      type: input.type,
      enabledModules: modules,
      theme: { ...s.organization.theme, ...input.theme },
    };
    return s.organization;
  });
}

export function enableModules(modules: ModuleId[]): Organization {
  return mutate((s) => {
    s.organization.enabledModules = normalizeModules([
      ...s.organization.enabledModules,
      ...modules,
    ]);
    return s.organization;
  });
}

export function disableModules(modules: ModuleId[]): Organization {
  return mutate((s) => {
    const disabled = new Set(modules);
    s.organization.enabledModules = s.organization.enabledModules.filter((id) => !disabled.has(id));
    return s.organization;
  });
}
