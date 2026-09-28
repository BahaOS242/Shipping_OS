/**
 * Intent-driven public pages. Each answers: what problem, how it works, who it's
 * for, what it costs (computed from the rates engine), what happens next, how to start.
 */
import type { DestinationId, ServiceLevel } from "@/domain/types";

export type SeoPage = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  problem: string;
  who: string[];
  how: [string, string][];
  examples: { label: string; destinationId: DestinationId; service: ServiceLevel; weight: number; dims?: [number, number, number] }[];
  costNote: string;
  next: string[];
  faq: [string, string][];
  cta: { label: string; href: string };
  related: string[];
};

const HOW_CORE: [string, string][] = [
  ["Get your U.S. address", "Every customer gets a personal Shipping OS address in Florida with their own account number."],
  ["Shop anywhere", "Use that address at checkout on Amazon, Walmart, Target or any U.S. store."],
  ["We receive it", "We scan, weigh and photograph each package and message you: “We have it!”"],
  ["We send it", "Send it right away or put several packages together. We prepare the customs paperwork."],
  ["You get it", "Pick it up at your island's pickup point or get home delivery where available."],
];

export const SEO_PAGES: SeoPage[] = [
  {
    slug: "shipping-to-bahamas",
    title: "Shipping to The Bahamas from the U.S.",
    description: "Ship anything from the United States to Nassau and the Family Islands. Air and ocean freight, simple prices, updates on WhatsApp.",
    h1: "Shipping to The Bahamas, made simple.",
    eyebrow: "Shipping to The Bahamas",
    problem: "Most U.S. stores won't ship to The Bahamas — or charge a fortune when they do. Freight forwarders help, but the process is confusing: waybills, customs forms, surprise fees. Shipping OS turns it into one simple flow you can follow from your phone.",
    who: ["Anyone in The Bahamas who shops online", "Families sending things home", "Small businesses restocking from U.S. suppliers"],
    how: HOW_CORE,
    examples: [
      { label: "Shoebox to Nassau by air", destinationId: "nassau", service: "air", weight: 5 },
      { label: "Microwave to Nassau by ocean", destinationId: "nassau", service: "ocean", weight: 30 },
      { label: "Laptop box to Exuma by air", destinationId: "exuma", service: "air", weight: 8 },
    ],
    costNote: "Priced by weight — or by size for big, light boxes. Customs duty and VAT are separate and depend on what you import.",
    next: ["Create your account and copy your U.S. address", "Shop and ship to that address", "Get a WhatsApp message when we have it"],
    faq: [
      ["How long does shipping take?", "Air usually takes 3–5 days door to door; ocean 10–14 days."],
      ["Do I pay customs duty?", "Yes — government duty and VAT apply to imports. We prepare the paperwork and show the charges clearly on your bill."],
      ["Can I ship to the Family Islands?", "Yes. We fly or sail to Abaco, Exuma, Eleuthera, Grand Bahama, Andros, Long Island and more."],
    ],
    cta: { label: "Calculate my cost", href: "/shipping-calculator" },
    related: ["us-address-bahamas", "package-consolidation-bahamas", "shipping-to-family-islands"],
  },
  {
    slug: "amazon-bahamas",
    title: "Amazon to The Bahamas — ship your Amazon orders home",
    description: "Buy on Amazon.com and get it delivered in The Bahamas. Use your Shipping OS U.S. address, we handle receiving, customs and delivery.",
    h1: "Your Amazon orders, delivered to The Bahamas.",
    eyebrow: "Amazon to The Bahamas",
    problem: "Many Amazon items say “doesn't ship to your location.” With a Shipping OS U.S. address, Amazon ships to our Florida warehouse like any U.S. order — and we bring it the rest of the way.",
    who: ["Amazon shoppers in Nassau and the Family Islands", "Parents buying school supplies and clothes", "Businesses using Amazon Business"],
    how: [
      ["Add your Shipping OS address to Amazon", "Save it as a shipping address: your name, “Shipping OS #TL…”, and our Florida warehouse."],
      ["Upload your Amazon receipt", "Snap or upload the order receipt. We read it and match it to your package automatically."],
      ["We check it in", "When Amazon delivers to us, you get “We have it!” with the weight."],
      ["Put orders together", "Several Amazon boxes? We combine them into one shipment to save money."],
      ["Delivered", "Pick up in Nassau or on your island, or choose home delivery where available."],
    ],
    examples: [
      { label: "Phone case to Nassau", destinationId: "nassau", service: "air", weight: 0.5 },
      { label: "Kitchen blender to Nassau", destinationId: "nassau", service: "air", weight: 4 },
      { label: "Three boxes put together to Abaco", destinationId: "abaco", service: "air", weight: 10 },
    ],
    costNote: "Small Amazon boxes often cost the minimum charge. Putting several together shares one minimum.",
    next: ["Copy your Shipping OS address into Amazon", "Order as usual", "Upload the receipt (or forward it) so customs is ready"],
    faq: [
      ["Will Amazon ship to your address?", "Yes — it's a U.S. address, so almost all Amazon items ship to it."],
      ["What about batteries?", "Some items (like power banks) have air restrictions. We flag them and suggest ocean if needed. Final decisions are made by our team."],
      ["Do I need the receipt?", "Yes. Customs needs the value. Upload it once and we attach it to the package."],
    ],
    cta: { label: "Get my U.S. address", href: "/us-address-bahamas" },
    related: ["us-address-bahamas", "package-consolidation-bahamas", "air-freight-bahamas"],
  },
  {
    slug: "us-address-bahamas",
    title: "Your U.S. shipping address in The Bahamas",
    description: "Get a personal U.S. address for online shopping from The Bahamas. Every package is received, matched to you, and brought home.",
    h1: "Your own U.S. address — for everything you buy.",
    eyebrow: "U.S. address for Bahamians",
    problem: "U.S. checkouts ask for a U.S. address. Yours is a Florida address with your personal account number, so every box that arrives is matched to you automatically — even without a pre-alert.",
    who: ["Online shoppers", "Students and families", "Businesses ordering from U.S. suppliers"],
    how: [
      ["Sign up", "You get an account number like TL10284."],
      ["Use the address", "Name · Shipping OS #TL10284 · our Florida warehouse. That's it."],
      ["We match it", "Our warehouse scans the label, reads your number and links the package to your account."],
      ["You're notified", "“We have it!” arrives in the app and on WhatsApp."],
      ["You decide", "Send it now, or wait and put it together with other packages."],
    ],
    examples: [{ label: "Typical small box to Nassau", destinationId: "nassau", service: "air", weight: 3 }],
    costNote: "The address is part of your account. You pay when a package is shipped to The Bahamas.",
    next: ["Copy your address", "Shop anywhere in the U.S.", "Track everything in My Packages"],
    faq: [
      ["What if I forget my account number?", "We still try to match by name. If we can't, our team contacts you — nothing gets lost."],
      ["How long can packages wait?", "The first 14 days of storage are free. After that a small daily fee applies (demo rules)."],
    ],
    cta: { label: "See my address", href: "/profile" },
    related: ["amazon-bahamas", "shipping-to-bahamas", "package-consolidation-bahamas"],
  },
  {
    slug: "freight-forwarding-bahamas",
    title: "Freight forwarding to The Bahamas — without the jargon",
    description: "A modern freight forwarder for The Bahamas: receiving, consolidation, customs paperwork, air and ocean freight and local delivery in one system.",
    h1: "Freight forwarding, explained in plain words.",
    eyebrow: "Freight forwarding",
    problem: "A freight forwarder receives your goods in the U.S., prepares the paperwork, books space on a plane or ship, and delivers on the other side. It shouldn't take a logistics degree to use one.",
    who: ["Shoppers bringing goods home", "Businesses importing stock", "Resorts and restaurants buying equipment"],
    how: [
      ["Receiving", "We check in every box: weight, size, photos and the store receipt."],
      ["Consolidation", "We put your packages together into one shipment."],
      ["Customs paperwork", "We build the customs packet from your receipts. A person reviews it."],
      ["Freight", "Air for speed, ocean for bigger or heavier items."],
      ["Last mile", "Pickup or delivery on your island, with proof of delivery."],
    ],
    examples: [
      { label: "Pallet of supplies to Nassau by ocean", destinationId: "nassau", service: "ocean", weight: 400, dims: [48, 40, 48] },
      { label: "Mixed order to Exuma by air", destinationId: "exuma", service: "air", weight: 25 },
    ],
    costNote: "Big boxes are priced by the greater of real weight or size-based weight.",
    next: ["Tell us what you're shipping", "Get an estimate", "Send it to your Shipping OS address"],
    faq: [
      ["Do you clear customs?", "We prepare the documents. Clearance decisions are made by authorized personnel — this demo only simulates that workflow."],
      ["Can you handle commercial freight?", "Yes — see Shipping OS for Business."],
    ],
    cta: { label: "Start shipping", href: "/ship" },
    related: ["commercial-freight-bahamas", "air-freight-bahamas", "ocean-freight-bahamas"],
  },
  {
    slug: "air-freight-bahamas",
    title: "Air freight to The Bahamas — fastest way to get it home",
    description: "Fly packages to Nassau and the Family Islands in about 3–5 days. Simple per-pound pricing and live updates.",
    h1: "Air freight: the fast way home. ✈️",
    eyebrow: "Air freight",
    problem: "When you need it soon — school supplies, phone parts, medicine-cabinet basics — air is the answer. Regular flights leave Florida for Nassau and connect to the Family Islands.",
    who: ["Small and medium packages", "Anything time-sensitive", "Electronics and clothing"],
    how: HOW_CORE,
    examples: [
      { label: "1 lb to Nassau", destinationId: "nassau", service: "air", weight: 1 },
      { label: "10 lb to Nassau", destinationId: "nassau", service: "air", weight: 10 },
      { label: "10 lb to Abaco", destinationId: "abaco", service: "air", weight: 10 },
    ],
    costNote: "Air is priced per pound with a small minimum. Large light boxes use size-based weight.",
    next: ["Check your price", "Ship to your Shipping OS address", "Choose “Faster” when you send"],
    faq: [
      ["What can't fly?", "Aerosols, some batteries and hazardous items have air restrictions. We'll suggest ocean when needed."],
      ["How often are flights?", "Nassau several times a week; Family Islands on set days (see Locations)."],
    ],
    cta: { label: "Calculate air cost", href: "/shipping-calculator?service=air" },
    related: ["ocean-freight-bahamas", "shipping-to-family-islands", "amazon-bahamas"],
  },
  {
    slug: "ocean-freight-bahamas",
    title: "Ocean freight to The Bahamas — for big and heavy items",
    description: "Ship furniture, appliances and bulk goods to The Bahamas by sea. Lower cost for heavy items, delivered in about 10–14 days.",
    h1: "Ocean freight: bigger items, smaller price. 🚢",
    eyebrow: "Ocean freight",
    problem: "Furniture, appliances, building materials and bulk orders are expensive to fly. Ocean freight costs far less per pound — you just wait a little longer.",
    who: ["Furniture and appliances", "Businesses restocking", "Anything heavy or oversized"],
    how: HOW_CORE,
    examples: [
      { label: "Patio chairs (40 lb) to Nassau", destinationId: "nassau", service: "ocean", weight: 40, dims: [30, 24, 20] },
      { label: "Washing machine (170 lb) to Nassau", destinationId: "nassau", service: "ocean", weight: 170, dims: [30, 28, 40] },
      { label: "Furniture (120 lb) to Exuma", destinationId: "exuma", service: "ocean", weight: 120, dims: [60, 30, 30] },
    ],
    costNote: "Ocean has a higher minimum but a much lower price per pound.",
    next: ["Estimate your cost", "Ship it to your Shipping OS address", "Choose “Bigger / slower” when you send"],
    faq: [["How long does ocean take?", "About 10–14 days including customs, depending on the sailing schedule."], ["Can you deliver big items?", "Yes — home delivery is available in Nassau and some islands."]],
    cta: { label: "Calculate ocean cost", href: "/shipping-calculator?service=ocean" },
    related: ["air-freight-bahamas", "commercial-freight-bahamas", "shipping-to-bahamas"],
  },
  {
    slug: "shipping-to-exuma",
    title: "Shipping to Exuma — packages and freight to George Town",
    description: "Get your online orders and freight delivered to Exuma. Air and ocean service, pickup in George Town or delivery.",
    h1: "Shipping to Exuma, without the runaround.",
    eyebrow: "Exuma",
    problem: "Getting things to Exuma usually means two steps — to Nassau, then onward. Shipping OS handles both legs and keeps one tracking timeline from checkout to George Town.",
    who: ["Exuma residents", "Resorts, villas and restaurants", "Second-home owners"],
    how: HOW_CORE,
    examples: [
      { label: "5 lb to Exuma by air", destinationId: "exuma", service: "air", weight: 5 },
      { label: "60 lb to Exuma by ocean", destinationId: "exuma", service: "ocean", weight: 60 },
    ],
    costNote: "Family Island prices include the onward trip from Nassau.",
    next: ["Get your U.S. address", "Ship and track", "Collect at George Town or choose delivery"],
    faq: [["Where do I pick up?", "Our George Town partner holds your packages (see Locations)."], ["Do you deliver on Exuma?", "Yes, through a partner courier, for a delivery fee."]],
    cta: { label: "Exuma prices", href: "/shipping-calculator?to=exuma" },
    related: ["shipping-to-family-islands", "shipping-to-abaco", "ocean-freight-bahamas"],
  },
  {
    slug: "shipping-to-abaco",
    title: "Shipping to Abaco — packages to Marsh Harbour",
    description: "Ship your U.S. purchases to Abaco. Air and ocean freight with pickup in Marsh Harbour.",
    h1: "Shipping to Abaco, all in one place.",
    eyebrow: "Abaco",
    problem: "Abaco residents often juggle multiple shippers for air, ocean and local pickup. Shipping OS gives you one address, one timeline and one bill.",
    who: ["Abaco families", "Builders and contractors", "Local shops"],
    how: HOW_CORE,
    examples: [
      { label: "5 lb to Abaco by air", destinationId: "abaco", service: "air", weight: 5 },
      { label: "Building supplies (200 lb) to Abaco by ocean", destinationId: "abaco", service: "ocean", weight: 200 },
    ],
    costNote: "Family Island prices include the onward trip from Nassau.",
    next: ["Get your U.S. address", "Ship and track", "Collect in Marsh Harbour"],
    faq: [["Where do I pick up?", "At our Marsh Harbour partner (see Locations)."], ["How often do you fly to Abaco?", "Several times a week (demo schedule)."]],
    cta: { label: "Abaco prices", href: "/shipping-calculator?to=abaco" },
    related: ["shipping-to-family-islands", "shipping-to-exuma", "air-freight-bahamas"],
  },
  {
    slug: "shipping-to-family-islands",
    title: "Shipping to the Family Islands",
    description: "Packages and freight to Eleuthera, Andros, Long Island, Grand Bahama, Bimini, Cat Island and more — tracked end to end.",
    h1: "Every island. One simple way to ship.",
    eyebrow: "Family Islands",
    problem: "The further from Nassau, the harder shipping gets. We connect U.S. stores to local pickup points and agents across the Family Islands — with one timeline you can follow.",
    who: ["Family Island residents", "Schools, clinics and churches", "Island businesses"],
    how: HOW_CORE,
    examples: [
      { label: "5 lb to Eleuthera by air", destinationId: "eleuthera", service: "air", weight: 5 },
      { label: "20 lb to Long Island by air", destinationId: "long_island", service: "air", weight: 20 },
      { label: "80 lb to Andros by ocean", destinationId: "andros", service: "ocean", weight: 80 },
    ],
    costNote: "Family Island prices include the onward trip from Nassau.",
    next: ["Check your island's schedule on Locations", "Ship to your Shipping OS address", "Collect at your island's pickup point"],
    faq: [["What if my island has no office?", "Our local agent network meets the mailboat or flight and holds your package."], ["Can I get delivery?", "In Grand Bahama and Exuma, yes. Elsewhere, pickup."]],
    cta: { label: "See locations", href: "/locations/family-islands" },
    related: ["shipping-to-exuma", "shipping-to-abaco", "ocean-freight-bahamas"],
  },
  {
    slug: "business-logistics-bahamas",
    title: "Business logistics in The Bahamas",
    description: "Receiving, inventory, consolidation, commercial freight, procurement and delivery for Bahamian businesses — one dashboard, one bill.",
    h1: "Your logistics team, without hiring one.",
    eyebrow: "Business logistics",
    problem: "Bahamian businesses lose hours chasing suppliers, forwarders, brokers and couriers. Shipping OS gives you one team and one dashboard for the whole chain.",
    who: ["Retailers and hardware stores", "Restaurants and hotels", "Contractors and clinics"],
    how: [
      ["Suppliers ship to us", "Amazon Business, Home Depot, Uline, Grainger — any U.S. supplier."],
      ["We receive and count", "Every box checked in with photos and invoice matching."],
      ["We consolidate", "Weekly or on demand, air or ocean."],
      ["Paperwork handled", "Supplier invoices become customs-ready packets."],
      ["Delivered to your door", "Truck delivery in Nassau; partners on the islands."],
    ],
    examples: [
      { label: "Weekly restock (150 lb) to Nassau by ocean", destinationId: "nassau", service: "ocean", weight: 150 },
      { label: "Urgent part (6 lb) to Nassau by air", destinationId: "nassau", service: "air", weight: 6 },
    ],
    costNote: "Business accounts get 30-day terms and volume pricing (demo).",
    next: ["Talk to our business team", "Connect your suppliers", "See everything in your business dashboard"],
    faq: [["Can you buy for us?", "Yes — tell us what you need and we source, buy, ship and deliver it (Buy for me)."], ["Do we get statements?", "Yes, monthly statements and a live balance."]],
    cta: { label: "Shipping OS for Business", href: "/business" },
    related: ["commercial-freight-bahamas", "freight-forwarding-bahamas", "ocean-freight-bahamas"],
  },
  {
    slug: "commercial-freight-bahamas",
    title: "Commercial freight to The Bahamas",
    description: "Pallets, equipment and bulk orders shipped by ocean or air to Nassau and the Family Islands, with customs paperwork prepared.",
    h1: "Commercial freight, handled end to end.",
    eyebrow: "Commercial freight",
    problem: "Pallets and equipment need booking, packing, documents and delivery — usually with four different companies. We do it as one.",
    who: ["Importers and wholesalers", "Hospitality and construction", "Anyone moving pallets or machinery"],
    how: HOW_CORE,
    examples: [
      { label: "One pallet (500 lb) to Nassau by ocean", destinationId: "nassau", service: "ocean", weight: 500, dims: [48, 40, 50] },
      { label: "Commercial refrigerator (350 lb) to Exuma", destinationId: "exuma", service: "ocean", weight: 350, dims: [55, 32, 80] },
    ],
    costNote: "Large items are priced by size-based weight when bigger than they are heavy.",
    next: ["Send us the supplier invoice", "Get an estimate", "We book, ship and deliver"],
    faq: [["Do you handle duty?", "We prepare documents and show duty estimates. Final amounts are set by customs."]],
    cta: { label: "Talk to business logistics", href: "/business#contact" },
    related: ["business-logistics-bahamas", "ocean-freight-bahamas", "freight-forwarding-bahamas"],
  },
  {
    slug: "package-consolidation-bahamas",
    title: "Put your packages together (package consolidation)",
    description: "Buying from several stores? We combine your packages into one shipment to The Bahamas — usually cheaper.",
    h1: "Put your packages together. Pay less.",
    eyebrow: "Package consolidation",
    problem: "Every shipment has a minimum charge. Three small boxes sent separately means three minimums. Put together, they travel as one shipment and share it.",
    who: ["Anyone ordering from more than one store", "Families doing back-to-school shopping", "Businesses with many small supplier boxes"],
    how: [
      ["Your boxes arrive", "Each gets its own Shipping OS package ID, weight and photos."],
      ["Pick which to combine", "In My Packages, tap “Put These Together” and choose."],
      ["We pack them as one shipment", "One shipment, one customs packet, one bill."],
      ["Travels together", "Air or ocean."],
      ["You collect once", "One pickup or one delivery."],
    ],
    examples: [
      { label: "Three small boxes (10 lb total) to Nassau", destinationId: "nassau", service: "air", weight: 10 },
      { label: "Same three boxes to Exuma", destinationId: "exuma", service: "air", weight: 10 },
    ],
    costNote: "Example: three 2–4 lb boxes sent separately each pay the minimum; together they're charged on combined weight.",
    next: ["Ship to your Shipping OS address as usual", "Wait until your boxes arrive (14 free storage days)", "Tap “Put These Together”"],
    faq: [["How long will you hold packages?", "14 days free while you wait for other boxes (demo rule)."], ["Can I mix air and ocean?", "A shipment travels one way. We'll suggest the best option."]],
    cta: { label: "Put my packages together", href: "/packages/together" },
    related: ["amazon-bahamas", "us-address-bahamas", "shipping-to-bahamas"],
  },
];

export const seoBySlug = (slug: string) => SEO_PAGES.find((p) => p.slug === slug);
