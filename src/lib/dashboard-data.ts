// Dummy data for the /dashboard demo — no backend yet, so every list here
// is static, seeded once into client state per page. Nothing persists
// across a refresh; that's expected until the real backend replaces this.

export type CrmContact = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  status: "Lead" | "Active" | "Past Client";
};

export const MOCK_CRM_CONTACTS: CrmContact[] = [
  { id: "c1", name: "Ananya Sharma", company: "Bloom Retail Pvt Ltd", email: "ananya@bloomretail.in", phone: "+91 98765 43210", city: "Mumbai", state: "Maharashtra", status: "Active" },
  { id: "c2", name: "Rohan Mehta", company: "Mehta Textiles", email: "rohan@mehtatextiles.com", phone: "+91 91234 56780", city: "Surat", state: "Gujarat", status: "Lead" },
  { id: "c3", name: "Priya Nair", company: "Nair & Co Consulting", email: "priya.nair@naircons.in", phone: "+91 90000 11223", city: "Kochi", state: "Kerala", status: "Active" },
  { id: "c4", name: "Vikram Singh", company: "Singh Logistics", email: "vikram@singhlogistics.co.in", phone: "+91 99887 76655", city: "Ludhiana", state: "Punjab", status: "Past Client" },
  { id: "c5", name: "Fatima Khan", company: "Khan Design Studio", email: "fatima@khandesign.studio", phone: "+91 93456 78901", city: "Lucknow", state: "Uttar Pradesh", status: "Lead" },
];

export type InvoiceItem = { label: string; amount: number };
export type Invoice = {
  id: string;
  client: string;
  billingCity?: string;
  billingState?: string;
  date: string;
  amount: number;
  status: "Paid" | "Pending" | "Overdue";
  items: InvoiceItem[];
};

export const MOCK_INVOICES: Invoice[] = [
  {
    id: "INV-1042",
    client: "Bloom Retail Pvt Ltd",
    billingCity: "Mumbai",
    billingState: "Maharashtra",
    date: "2026-07-12",
    amount: 24500,
    status: "Paid",
    items: [
      { label: "GST Filing — Q1", amount: 8500 },
      { label: "Compliance Retainer", amount: 16000 },
    ],
  },
  {
    id: "INV-1043",
    client: "Mehta Textiles",
    billingCity: "Surat",
    billingState: "Gujarat",
    date: "2026-07-18",
    amount: 11999,
    status: "Pending",
    items: [{ label: "Private Limited Company Registration", amount: 11999 }],
  },
  {
    id: "INV-1044",
    client: "Nair & Co Consulting",
    billingCity: "Kochi",
    billingState: "Kerala",
    date: "2026-07-02",
    amount: 6500,
    status: "Overdue",
    items: [{ label: "Trademark Registration — Filing Fee", amount: 6500 }],
  },
];

export type Order = {
  id: string;
  service: string;
  plan: string;
  amount: string;
  status: "Completed" | "In Progress" | "Awaiting Documents";
  date: string;
};

export const MOCK_ORDERS: Order[] = [
  { id: "ORD-2291", service: "Private Limited Company", plan: "Standard", amount: "₹11,999", status: "Completed", date: "2026-05-14" },
  { id: "ORD-2338", service: "GST Registration", plan: "Basic", amount: "₹1,999", status: "Completed", date: "2026-06-02" },
  { id: "ORD-2390", service: "Trademark Registration", plan: "Standard", amount: "₹6,500", status: "In Progress", date: "2026-07-09" },
  { id: "ORD-2401", service: "Annual Compliance", plan: "Full Year", amount: "₹14,999", status: "Awaiting Documents", date: "2026-07-20" },
];
