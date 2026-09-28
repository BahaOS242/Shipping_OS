import type {
  Customer,
  ID,
  Invoice,
  Location,
  Notification,
  Package,
  Quote,
  Shipment,
  SupportTicket,
} from "../types";

/**
 * Persistence boundary.
 *
 * Only the Link API (src/lib/api) talks to a Repository. The AI agent and
 * channels never do. Swap MockRepository for a PostgresRepository (or an
 * adapter over The Link's warehouse system) without touching anything above.
 */
export interface Repository {
  findCustomer(id: ID): Promise<Customer | undefined>;
  findCustomerByPhone(phone: string): Promise<Customer | undefined>;
  listCustomers(): Promise<Customer[]>;

  listPackages(filter?: { customerId?: ID }): Promise<Package[]>;
  findPackage(id: ID): Promise<Package | undefined>;

  findShipment(id: ID): Promise<Shipment | undefined>;
  listShipments(): Promise<Shipment[]>;

  listLocations(): Promise<Location[]>;

  saveQuote(q: Quote): Promise<Quote>;
  listQuotes(filter?: { customerId?: ID }): Promise<Quote[]>;

  listInvoices(filter?: { customerId?: ID }): Promise<Invoice[]>;

  saveTicket(t: SupportTicket): Promise<SupportTicket>;
  findTicket(id: ID): Promise<SupportTicket | undefined>;
  listTickets(filter?: { customerId?: ID }): Promise<SupportTicket[]>;

  listNotifications(customerId: ID): Promise<Notification[]>;
}
