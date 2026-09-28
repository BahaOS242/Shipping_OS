import { DEMO_CUSTOMER_ID } from "./data/seed";

/**
 * DEMO: everyone is signed in as Trevor.
 * Production: read the customer from the session (web) or from the verified
 * WhatsApp phone number (channel). The AI never chooses the customer.
 */
export async function getSessionCustomerId(): Promise<string> {
  return DEMO_CUSTOMER_ID;
}
