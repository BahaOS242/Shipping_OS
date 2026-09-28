import type { Repository } from "./repository";
import * as seed from "./seed";
import type { Quote, SupportTicket } from "../types";

/**
 * DEMO: in-memory repository over seed data.
 * Writes (quotes, tickets) live only in server memory and reset on restart.
 */
const quotes: Quote[] = [...seed.quotes];
const tickets: SupportTicket[] = [...seed.supportTickets];

const byCustomer = <T extends { customerId?: string }>(rows: T[], customerId?: string) =>
  customerId ? rows.filter((r) => r.customerId === customerId) : rows;

export const mockRepository: Repository = {
  async findCustomer(id) {
    return seed.customers.find((c) => c.id === id);
  },
  async findCustomerByPhone(phone) {
    const digits = phone.replace(/\D/g, "");
    return seed.customers.find((c) => c.phone.replace(/\D/g, "") === digits);
  },
  async listCustomers() {
    return seed.customers;
  },

  async listPackages(filter) {
    return byCustomer(seed.packages, filter?.customerId);
  },
  async findPackage(id) {
    return seed.packages.find((p) => p.id === id);
  },

  async findShipment(id) {
    return seed.shipments.find((s) => s.id === id);
  },
  async listShipments() {
    return seed.shipments;
  },

  async listLocations() {
    return seed.locations;
  },

  async saveQuote(q) {
    quotes.push(q);
    return q;
  },
  async listQuotes(filter) {
    return byCustomer(quotes, filter?.customerId);
  },

  async listInvoices(filter) {
    return byCustomer(seed.invoices, filter?.customerId);
  },

  async saveTicket(t) {
    const i = tickets.findIndex((x) => x.id === t.id);
    if (i >= 0) tickets[i] = t;
    else tickets.unshift(t);
    return t;
  },
  async findTicket(id) {
    return tickets.find((t) => t.id === id);
  },
  async listTickets(filter) {
    return byCustomer(tickets, filter?.customerId);
  },

  async listNotifications(customerId) {
    return seed.notifications.filter((n) => n.customerId === customerId);
  },
};
