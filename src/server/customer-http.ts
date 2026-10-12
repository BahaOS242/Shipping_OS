import "server-only";
import { cookies } from "next/headers";
export const customerCookieName =
  process.env.NODE_ENV === "production"
    ? "__Host-pilot_customer"
    : "pilot_customer";
export async function customerToken() {
  return (await cookies()).get(customerCookieName)?.value;
}
