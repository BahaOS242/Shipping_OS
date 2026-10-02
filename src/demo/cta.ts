/** Where the demo's calls to action go. Swap for a booking tool / CRM form when ready. */
export const BOOK_DEMO_EMAIL = "demo@shippingos.example";
export const WHATSAPP_NUMBER = "12425550100";

export const bookDemoHref = (operation?: string) =>
  `mailto:${BOOK_DEMO_EMAIL}?subject=${encodeURIComponent(`Personalized Shipping OS demo${operation ? ` — ${operation}` : ""}`)}&body=${encodeURIComponent("Company:\nIslands / routes we serve:\nTeam size:\nWhat we'd like to see:\n")}`;

export const whatsappHref = (operation?: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Shipping OS — I just tried the ${operation ?? "interactive"} demo and I'd like to talk.`)}`;
