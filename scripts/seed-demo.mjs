// Builds the entire demo environment from an empty database, following
// the product's real onboarding path rather than writing the end state
// straight to the tables:
//
//   1. Legal Efilings — the SaaS provider (Delhi). Its own staff, its own
//      customers, its own service catalog.
//   2. Rishabh Khanna signs up as an ordinary PAID CUSTOMER of Legal
//      Efilings and buys a plan, which is paid in full.
//   3. He requests a CRM workspace for his business, "Chatak Singh".
//   4. Nandini Iyer (platform operator) approves it. That approval is what
//      creates the Chatak Singh organization and promotes Rishabh to its
//      ADMIN — a customer account never holds CRM tools; getting CRM
//      access *means* becoming an admin of your own organization.
//   5. As that new admin, Rishabh sets up his business: GSTIN and bank
//      details, a mouth-freshener (mukhwas) catalog, his staff, his B2B
//      buyers, and then real invoices and payroll.
//
// Steps 2-4 and every invoice/payslip run through the app's own HTTP APIs
// with a real signed-in session, so the GST maths, invoice numbering,
// LOP calculation and access checks are the same code paths a human
// hits. Reference data with no API behind it (attendance history, salary
// structures) is written directly.
//
// Requires `npm run dev` on :3000. Safe to re-run — it purges first.
//
// Usage: node scripts/seed-demo.mjs

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "child_process";

process.loadEnvFile(new URL("../.env.local", import.meta.url).pathname);

const BASE = "http://localhost:3000";
export const DEMO_PASSWORD = "Chatak@2026";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

// ───────────────────────── people ─────────────────────────

const LEGAL_STAFF = [
  { email: "nandini.iyer@legalefilings.com", full_name: "Nandini Iyer", account_type: "admin", is_platform_admin: true,
    employee_id: "LE-0001", department: "Management", designation: "Founder & Managing Director",
    date_of_joining: "2021-04-01", date_of_birth: "1984-07-19", phone: "+91 98110 24567",
    pan_number: "AFTPI2345K", aadhaar_number: "4821 7734 9012", uan_number: "101234500001", esic_number: "1100045678000001",
    bank_name: "HDFC Bank", bank_account_number: "50100234567890", bank_ifsc: "HDFC0000123",
    emergency_contact_name: "Suresh Iyer", emergency_contact_phone: "+91 98110 24568",
    salary: { basic: 90000, hra: 36000, special_allowance: 18000, bonus: 15000, incentives: 0 } },
  { email: "arvind.menon@legalefilings.com", full_name: "Arvind Menon", account_type: "admin",
    employee_id: "LE-0002", department: "Compliance", designation: "Head of Compliance",
    date_of_joining: "2021-09-15", date_of_birth: "1987-02-11", phone: "+91 98111 33421",
    pan_number: "BKMPM6789L", aadhaar_number: "5932 8845 1123", uan_number: "101234500002", esic_number: "1100045678000002",
    bank_name: "ICICI Bank", bank_account_number: "60200345678901", bank_ifsc: "ICIC0000456",
    emergency_contact_name: "Lakshmi Menon", emergency_contact_phone: "+91 98111 33422",
    salary: { basic: 65000, hra: 26000, special_allowance: 13000, bonus: 9000, incentives: 0 } },
  { email: "kavya.reddy@legalefilings.com", full_name: "Kavya Reddy", account_type: "staff", staff_level: "group_leader",
    employee_id: "LE-0003", department: "Filings", designation: "Group Leader — Filings",
    date_of_joining: "2022-03-07", date_of_birth: "1991-11-30", phone: "+91 99532 11876",
    pan_number: "CLNPR3456M", aadhaar_number: "6043 9956 2234", uan_number: "101234500003", esic_number: "1100045678000003",
    bank_name: "Axis Bank", bank_account_number: "91100456789012", bank_ifsc: "UTIB0000789",
    emergency_contact_name: "Ravi Reddy", emergency_contact_phone: "+91 99532 11877",
    salary: { basic: 52000, hra: 20800, special_allowance: 10000, bonus: 6000, incentives: 2000 } },
  { email: "farhan.qureshi@legalefilings.com", full_name: "Farhan Qureshi", account_type: "staff", staff_level: "leader",
    reportsTo: "kavya.reddy@legalefilings.com",
    employee_id: "LE-0004", department: "Filings", designation: "Team Lead — ROC Filings",
    date_of_joining: "2023-01-16", date_of_birth: "1994-05-22", phone: "+91 97173 45290",
    pan_number: "DMQPQ7890N", aadhaar_number: "7154 1067 3345", uan_number: "101234500004", esic_number: "1100045678000004",
    bank_name: "State Bank of India", bank_account_number: "31200567890123", bank_ifsc: "SBIN0001234",
    emergency_contact_name: "Rukhsana Qureshi", emergency_contact_phone: "+91 97173 45291",
    salary: { basic: 36000, hra: 14400, special_allowance: 6500, bonus: 3500, incentives: 1500 } },
  { email: "sneha.kulkarni@legalefilings.com", full_name: "Sneha Kulkarni", account_type: "staff", staff_level: "rater",
    reportsTo: "farhan.qureshi@legalefilings.com",
    employee_id: "LE-0005", department: "Filings", designation: "Compliance Associate",
    date_of_joining: "2024-06-03", date_of_birth: "1998-09-08", phone: "+91 96501 78234",
    pan_number: "ENRPK1234P", aadhaar_number: "8265 2178 4456", uan_number: "101234500005", esic_number: "1100045678000005",
    bank_name: "Kotak Mahindra Bank", bank_account_number: "78500678901234", bank_ifsc: "KKBK0000321",
    emergency_contact_name: "Madhav Kulkarni", emergency_contact_phone: "+91 96501 78235",
    salary: { basic: 24000, hra: 9600, special_allowance: 4200, bonus: 2000, incentives: 1800 } },
];

// Customers OF Legal Efilings. Rishabh is one of them at this stage — he
// only becomes an admin further down, via the CRM-access approval.
const LEGAL_CUSTOMERS = [
  { email: "rishabhkhanna.93@gmail.com", full_name: "Rishabh Khanna", customer_tier: "paid",
    company: "Chatak Singh Mukhwas", phone: "+91 93890 41276",
    city: "Kanpur", state: "Uttar Pradesh", state_code: "09",
    gstin: "09AABCC1234D1Z5", pan_number: "AABCC1234D", aadhaar_number: "1487 4390 6678",
    date_of_birth: "1993-06-21",
    billing_address: "14/72 Civil Lines, Mall Road, Kanpur, Uttar Pradesh 208001",
    shipping_address: "Plot 23, Panki Industrial Area Site-II, Kanpur, Uttar Pradesh 208022" },
  { email: "aarti.deshpande@deshpandetextiles.in", full_name: "Aarti Deshpande", customer_tier: "paid",
    company: "Deshpande Textiles LLP", phone: "+91 98221 45677",
    city: "Pune", state: "Maharashtra", state_code: "27",
    gstin: "27AAGFD1234N1Z8", pan_number: "AAGFD1234N", date_of_birth: "1982-12-04",
    billing_address: "Plot 41, Rajiv Gandhi Infotech Park, Hinjawadi, Pune, Maharashtra 411057" },
  { email: "imran.shaikh@crescenttraders.co.in", full_name: "Imran Shaikh", customer_tier: "free",
    company: "Crescent Traders", phone: "+91 90003 22188",
    city: "Hyderabad", state: "Telangana", state_code: "36",
    gstin: "36AXBPS5678Q1Z1", pan_number: "AXBPS5678Q", date_of_birth: "1989-03-27",
    billing_address: "8-2-120/A, Road No. 2, Banjara Hills, Hyderabad, Telangana 500034" },
];

// Chatak Singh's own team, created after Rishabh becomes its admin.
const CHATAK_STAFF = [
  { email: "manpreet.kaur@chataksingh.in", full_name: "Manpreet Kaur", account_type: "staff", staff_level: "group_leader",
    employee_id: "CS-0002", department: "Operations", designation: "Operations Manager",
    date_of_joining: "2022-05-02", date_of_birth: "1988-08-14", phone: "+91 94150 66789",
    pan_number: "FGHPK5678R", aadhaar_number: "9376 3289 5567", uan_number: "101234600001", esic_number: "1300012345000001",
    bank_name: "Punjab National Bank", bank_account_number: "0123000100789012", bank_ifsc: "PUNB0012300",
    emergency_contact_name: "Jaspreet Singh", emergency_contact_phone: "+91 94150 66790",
    salary: { basic: 45000, hra: 18000, special_allowance: 9000, bonus: 6000, incentives: 0 } },
  { email: "vikas.dwivedi@chataksingh.in", full_name: "Vikas Dwivedi", account_type: "staff", staff_level: "leader",
    reportsTo: "manpreet.kaur@chataksingh.in",
    employee_id: "CS-0003", department: "Sales", designation: "Sales Head — North India",
    date_of_joining: "2022-08-11", date_of_birth: "1986-01-25", phone: "+91 94151 23904",
    pan_number: "GHJPD9012S", aadhaar_number: "2598 5401 7789", uan_number: "101234600002", esic_number: "1300012345000002",
    bank_name: "Bank of Baroda", bank_account_number: "24560100234567", bank_ifsc: "BARB0KANPUR",
    emergency_contact_name: "Sarita Dwivedi", emergency_contact_phone: "+91 94151 23905",
    salary: { basic: 55000, hra: 22000, special_allowance: 12000, bonus: 8000, incentives: 5000 } },
  { email: "anjali.verma@chataksingh.in", full_name: "Anjali Verma", account_type: "staff", staff_level: "rater",
    reportsTo: "vikas.dwivedi@chataksingh.in",
    employee_id: "CS-0004", department: "Sales", designation: "Regional Sales Executive",
    date_of_joining: "2023-04-17", date_of_birth: "1992-10-09", phone: "+91 94152 87310",
    pan_number: "HJKPV3456T", aadhaar_number: "3609 6512 8890", uan_number: "101234600003", esic_number: "1300012345000003",
    bank_name: "Bank of Baroda", bank_account_number: "24560100345678", bank_ifsc: "BARB0KANPUR",
    emergency_contact_name: "Rakesh Verma", emergency_contact_phone: "+91 94152 87311",
    salary: { basic: 38000, hra: 15200, special_allowance: 7000, bonus: 4000, incentives: 3000 } },
  { email: "sahil.bhatia@chataksingh.in", full_name: "Sahil Bhatia", account_type: "staff", staff_level: "rater",
    reportsTo: "vikas.dwivedi@chataksingh.in",
    employee_id: "CS-0005", department: "Sales", designation: "Sales Executive",
    date_of_joining: "2024-02-05", date_of_birth: "1997-04-16", phone: "+91 94153 40928",
    pan_number: "JKLPB7890U", aadhaar_number: "4710 7623 9901", uan_number: "101234600004", esic_number: "1300012345000004",
    bank_name: "Union Bank of India", bank_account_number: "39870110045678", bank_ifsc: "UBIN0539872",
    emergency_contact_name: "Kiran Bhatia", emergency_contact_phone: "+91 94153 40929",
    salary: { basic: 22000, hra: 8800, special_allowance: 4000, bonus: 1500, incentives: 2500 } },
  { email: "nusrat.ali@chataksingh.in", full_name: "Nusrat Ali", account_type: "staff", staff_level: "rater",
    reportsTo: "vikas.dwivedi@chataksingh.in",
    employee_id: "CS-0006", department: "Dispatch", designation: "Dispatch Coordinator",
    date_of_joining: "2024-11-18", date_of_birth: "1999-12-02", phone: "+91 94154 61073",
    pan_number: "KLMPA1234V", aadhaar_number: "5821 8734 1012", uan_number: "101234600005", esic_number: "1300012345000005",
    bank_name: "Union Bank of India", bank_account_number: "39870110056789", bank_ifsc: "UBIN0539872",
    emergency_contact_name: "Firoz Ali", emergency_contact_phone: "+91 94154 61074",
    salary: { basic: 21000, hra: 8400, special_allowance: 3800, bonus: 1500, incentives: 2200 } },
];

// Chatak Singh's B2B buyers. Kanpur/Lucknow are intra-state (CGST+SGST);
// Delhi and Jaipur are inter-state (IGST) — so both GST treatments get
// exercised by real invoices rather than only one.
const CHATAK_BUYERS = [
  { email: "naresh.agarwal@shreebalajistores.in", full_name: "Naresh Agarwal", customer_tier: "paid",
    company: "Shree Balaji Provision Stores", phone: "+91 93350 71204",
    city: "Kanpur", state: "Uttar Pradesh", state_code: "09",
    gstin: "09AKQPA5678L1Z9", pan_number: "AKQPA5678L", date_of_birth: "1979-05-13",
    billing_address: "Shop 12, Naveen Market, Mall Road, Kanpur, Uttar Pradesh 208001" },
  { email: "sunil.gupta@guptakirana.co.in", full_name: "Sunil Gupta", customer_tier: "paid",
    company: "Gupta Kirana & General Store", phone: "+91 93351 88460",
    city: "Lucknow", state: "Uttar Pradesh", state_code: "09",
    gstin: "09BNTPG9012K1Z4", pan_number: "BNTPG9012K", date_of_birth: "1975-11-21",
    billing_address: "B-27, Aminabad Market, Lucknow, Uttar Pradesh 226018" },
  { email: "deepak.anand@anmolsweets.in", full_name: "Deepak Anand", customer_tier: "paid",
    company: "Anmol Sweets & Namkeen", phone: "+91 98108 30572",
    city: "New Delhi", state: "Delhi", state_code: "07",
    gstin: "07CRJPA3456H1Z2", pan_number: "CRJPA3456H", date_of_birth: "1983-02-28",
    billing_address: "45 Karol Bagh Main Market, New Delhi 110005" },
  { email: "meena.chauhan@rajwadistores.in", full_name: "Meena Chauhan", customer_tier: "free",
    company: "Rajwadi Departmental Store", phone: "+91 94140 26918",
    city: "Jaipur", state: "Rajasthan", state_code: "08",
    gstin: "08DKLPC7890F1Z6", pan_number: "DKLPC7890F", date_of_birth: "1986-07-07",
    billing_address: "MI Road, Panch Batti, Jaipur, Rajasthan 302001" },
];

// Real mukhwas product lines with the HSN codes and GST slabs those
// goods genuinely attract: fennel seed as an unprocessed spice is 5%,
// prepared nut blends 12%, finished mouth-freshener preparations under
// heading 2106 are 18%.
const CHATAK_CATALOG = [
  { type: "product", name: "Roasted Saunf Mukhwas", hsnSacCode: "21069099", gstRate: 18, unit: "Kg", defaultRate: 280, description: "Slow-roasted fennel with rock salt — house bestseller" },
  { type: "product", name: "Silver Coated Elaichi Mukhwas", hsnSacCode: "21069099", gstRate: 18, unit: "Kg", defaultRate: 1450, description: "Green cardamom with edible silver leaf (chandi warq)" },
  { type: "product", name: "Meethi Supari", hsnSacCode: "21069030", gstRate: 18, unit: "Kg", defaultRate: 320, description: "Sweetened scented betel nut, fine cut" },
  { type: "product", name: "Dhaniya Dal Mukhwas", hsnSacCode: "21069099", gstRate: 18, unit: "Kg", defaultRate: 240, description: "Split roasted coriander seed, lightly salted" },
  { type: "product", name: "Gulkand Pan Mukhwas", hsnSacCode: "21069099", gstRate: 18, unit: "Kg", defaultRate: 520, description: "Rose petal preserve with betel leaf and fennel" },
  { type: "product", name: "Chocolate Coated Saunf", hsnSacCode: "21069099", gstRate: 18, unit: "Kg", defaultRate: 680, description: "Fennel centres in a cocoa shell" },
  { type: "product", name: "Mixed Mukhwas Special", hsnSacCode: "21069099", gstRate: 18, unit: "Kg", defaultRate: 360, description: "Seven-seed house blend with dry coconut and sesame" },
  { type: "product", name: "Plain Fennel Seeds (Saunf)", hsnSacCode: "09096211", gstRate: 5, unit: "Kg", defaultRate: 190, description: "Unprocessed Lucknowi fennel, loose — raw spice slab" },
  { type: "product", name: "Dry Fruit Mukhwas Blend", hsnSacCode: "20081910", gstRate: 12, unit: "Kg", defaultRate: 890, description: "Almond, cashew and pistachio slivers with fennel" },
  { type: "product", name: "Mukhwas Gift Tin 500g", hsnSacCode: "21069099", gstRate: 18, unit: "Nos", defaultRate: 450, description: "Printed festive tin, four-compartment assortment" },
  { type: "service", name: "Private Label Packing", hsnSacCode: "998819", gstRate: 18, unit: "Nos", defaultRate: 25, description: "Buyer-branded pouch packing, per unit" },
  { type: "service", name: "Local Freight & Delivery", hsnSacCode: "996511", gstRate: 5, unit: "Nos", defaultRate: 850, description: "Road transport within Uttar Pradesh, per consignment" },
];

const LEGAL_CATALOG = [
  { type: "service", name: "GST Registration", hsnSacCode: "998231", gstRate: 18, unit: "Nos", defaultRate: 1999, description: "New GSTIN application and follow-up" },
  { type: "service", name: "Private Limited Company Registration", hsnSacCode: "998231", gstRate: 18, unit: "Nos", defaultRate: 11999, description: "Incorporation including DIN, DSC and MOA/AOA" },
  { type: "service", name: "Trademark Registration", hsnSacCode: "998232", gstRate: 18, unit: "Nos", defaultRate: 6500, description: "Class search, filing and objection handling" },
  { type: "service", name: "Annual ROC Compliance", hsnSacCode: "998231", gstRate: 18, unit: "Nos", defaultRate: 14999, description: "AOC-4, MGT-7 and director KYC for one financial year" },
  { type: "service", name: "CRM Workspace — Business Annual Plan", hsnSacCode: "998314", gstRate: 18, unit: "Nos", defaultRate: 49999, description: "One year of a dedicated CRM workspace" },
];

const HOLIDAYS_2026 = [
  ["Republic Day", "2026-01-26", "national"], ["Holi", "2026-03-04", "festival"],
  ["Id-ul-Fitr", "2026-03-21", "festival"], ["Ram Navami", "2026-03-27", "festival"],
  ["Foundation Day", "2026-04-01", "company"], ["Independence Day", "2026-08-15", "national"],
  ["Raksha Bandhan", "2026-08-28", "festival"], ["Janmashtami", "2026-09-04", "festival"],
  ["Gandhi Jayanti", "2026-10-02", "national"], ["Dussehra", "2026-10-20", "festival"],
  ["Diwali", "2026-11-08", "festival"], ["Guru Nanak Jayanti", "2026-11-24", "festival"],
  ["Christmas", "2026-12-25", "festival"],
];

const LEADS = {
  legal: [
    ["Harsh Vardhan", "Vardhan Enterprises", "harsh@vardhanenterprises.in", "+91 98180 44712", "Gurugram", "Haryana", "GST Registration", "new", "sneha.kulkarni@legalefilings.com", "New trading firm, needs GSTIN before the quarter closes."],
    ["Nikita Joshi", "Joshi Interiors", "nikita@joshiinteriors.co.in", "+91 98600 21734", "Nashik", "Maharashtra", "Private Limited Company Registration", "contacted", "sneha.kulkarni@legalefilings.com", "Converting proprietorship to Pvt Ltd."],
    ["Suresh Pillai", "Pillai Exports", "suresh@pillaiexports.in", "+91 94470 88301", "Kochi", "Kerala", "IEC Registration", "won", "farhan.qureshi@legalefilings.com", "Spice exporter starting shipments to the Gulf."],
  ],
  chatak: [
    ["Ramesh Sahu", "Sahu General Store", "ramesh.sahu@sahustores.in", "+91 94500 31782", "Varanasi", "Uttar Pradesh", "Bulk Mukhwas Supply", "new", "sahil.bhatia@chataksingh.in", "Wants monthly supply of 40kg mixed mukhwas for retail counter."],
    ["Pooja Bhatt", "Bhatt Sweets & Caterers", "pooja@bhattsweets.co.in", "+91 94501 62093", "Agra", "Uttar Pradesh", "Wedding Season Bulk Order", "contacted", "sahil.bhatia@chataksingh.in", "Needs 300 gift tins before the November wedding season."],
    ["Iqbal Ansari", "Ansari Wholesale Mart", "iqbal@ansariwholesale.in", "+91 94502 47115", "Prayagraj", "Uttar Pradesh", "Distributor Enquiry", "in_progress", "anjali.verma@chataksingh.in", "Asking for district-level distributorship and margin structure."],
    ["Tarun Malhotra", "Malhotra Retail Chain", "tarun@malhotraretail.in", "+91 98730 55841", "Noida", "Uttar Pradesh", "Private Label Packing", "won", "vikas.dwivedi@chataksingh.in", "Wants own-brand pouches across 6 stores."],
    ["Shalini Rao", "Rao Provision Store", "shalini.rao@raoprovision.in", "+91 94503 90226", "Gorakhpur", "Uttar Pradesh", "Sample Request", "lost", "anjali.verma@chataksingh.in", "Went with a local supplier on price."],
  ],
};

// ───────────────────────── helpers ─────────────────────────

const ids = {};
async function createAccount(person, organizationId, accountType) {
  const { data, error } = await supabase.auth.admin.createUser({ email: person.email, password: DEMO_PASSWORD, email_confirm: true });
  if (error) throw new Error(`createUser(${person.email}): ${error.message}`);
  ids[person.email] = data.user.id;
  const { error: pErr } = await supabase.from("profiles").insert({
    id: data.user.id, organization_id: organizationId,
    full_name: person.full_name, account_type: accountType,
    staff_level: person.staff_level ?? null, customer_tier: person.customer_tier ?? null,
    is_platform_admin: person.is_platform_admin ?? false,
    crm_status: accountType === "customer" ? "active" : "lead",
    phone: person.phone ?? null, company: person.company ?? null,
    city: person.city ?? null, state: person.state ?? null, state_code: person.state_code ?? null,
    gstin: person.gstin ?? null, pan_number: person.pan_number ?? null, aadhaar_number: person.aadhaar_number ?? null,
    date_of_birth: person.date_of_birth ?? null, date_of_joining: person.date_of_joining ?? null,
    employee_id: person.employee_id ?? null, department: person.department ?? null, designation: person.designation ?? null,
    billing_address: person.billing_address ?? null, shipping_address: person.shipping_address ?? null,
    bank_name: person.bank_name ?? null, bank_account_number: person.bank_account_number ?? null, bank_ifsc: person.bank_ifsc ?? null,
    uan_number: person.uan_number ?? null, esic_number: person.esic_number ?? null,
    emergency_contact_name: person.emergency_contact_name ?? null, emergency_contact_phone: person.emergency_contact_phone ?? null,
  });
  if (pErr) throw new Error(`profile ${person.email}: ${pErr.message}`);
  return data.user.id;
}

async function insert(table, rows, label) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) throw new Error(`${label ?? table}: ${error.message}`);
  return data;
}

const browser = await chromium.launch();
async function signIn(email) {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.fill("#login-email", email);
  await page.fill("#login-password", DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 25000 });
  return { ctx, api: ctx.request };
}
async function send(api, method, path, data) {
  const res = await api[method](path, { data });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} -> ${res.status()} ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}
const post = (api, path, data) => send(api, "post", path, data);
const patch = (api, path, data) => send(api, "patch", path, data);

async function seedHrData(orgKey, orgId, staff) {
  await insert("holidays", HOLIDAYS_2026.map(([name, date, type]) => ({ name, date, type, organization_id: orgId })));
  for (const p of staff.filter((x) => x.salary)) {
    await insert("salary_structures", [{ staff_id: ids[p.email], organization_id: orgId, ...p.salary, effective_from: p.date_of_joining }]);
  }
  await insert("leads", LEADS[orgKey].map(([name, company, email, phone, city, state, service, status, assignTo, message]) => ({
    organization_id: orgId, name, company, email, phone, city, state, service, status, message,
    assigned_to: ids[assignTo], source: "website_consultation_form",
  })));

  // Attendance far enough back that June and July are both fully covered,
  // so payroll for those months computes real Loss of Pay instead of
  // treating every uncovered day as an absence.
  const holidaySet = new Set(HOLIDAYS_2026.map(([, d]) => d));
  const ABSENT = { "sahil.bhatia@chataksingh.in": 3, "nusrat.ali@chataksingh.in": 1, "sneha.kulkarni@legalefilings.com": 2 };
  const taken = {};
  const rows = [];
  for (const p of staff.filter((x) => x.salary)) {
    for (let back = 110; back >= 1; back--) {
      const day = daysFromNow(-back);
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      if (holidaySet.has(iso(day))) continue;
      if ((taken[p.email] ?? 0) < (ABSENT[p.email] ?? 0) && back % 17 === 3) { taken[p.email] = (taken[p.email] ?? 0) + 1; continue; }
      const a = new Date(day); a.setHours(9, 25 + (back % 25), 0, 0);
      const b = new Date(day); b.setHours(18, 5 + (back % 40), 0, 0);
      rows.push({ staff_id: ids[p.email], organization_id: orgId, event_type: "check_in", occurred_at: a.toISOString() },
                { staff_id: ids[p.email], organization_id: orgId, event_type: "check_out", occurred_at: b.toISOString() });
    }
  }
  for (let i = 0; i < rows.length; i += 500) await insert("attendance_events", rows.slice(i, i + 500));
  return rows.length;
}

// ───────────────────────── run ─────────────────────────

console.log("Purging existing data…");
execFileSync("node", [new URL("./purge-all-data.mjs", import.meta.url).pathname, "--yes"], { stdio: "ignore" });

// ---- 1. Legal Efilings ----
console.log("\n1. Legal Efilings — the provider");
const [legalOrg] = await insert("organizations", [{ name: "Legal Efilings", slug: "legal-efilings", plan_tier: "internal" }]);
await insert("company_settings", [{
  organization_id: legalOrg.id,
  address: "3rd Floor, Rohit House, Tolstoy Marg, Connaught Place, New Delhi 110001",
  gst_number: "07AAECL5678M1Z3", pan_number: "AAECL5678M",
  pf_number: "DL/CPM/0045678", esic_number: "11000456780000101",
  state: "Delhi", state_code: "07", financial_year_start_month: 4,
  bank_name: "HDFC Bank", bank_account_number: "50200078451236", bank_ifsc: "HDFC0000123",
  bank_branch: "Connaught Place, New Delhi", upi_id: "legalefilings@hdfcbank",
  invoice_number_prefix: "LE",
  default_invoice_notes: "Payment due within 15 days of invoice date. GST once charged is non-refundable. Subject to New Delhi jurisdiction.",
}]);
for (const p of LEGAL_STAFF) await createAccount(p, legalOrg.id, p.account_type);
for (const p of LEGAL_CUSTOMERS) await createAccount(p, legalOrg.id, "customer");
for (const p of LEGAL_STAFF.filter((x) => x.reportsTo)) {
  await supabase.from("profiles").update({ reports_to: ids[p.reportsTo] }).eq("id", ids[p.email]);
}
await supabase.from("organizations").update({ created_by: ids["nandini.iyer@legalefilings.com"] }).eq("id", legalOrg.id);
const [filings] = await insert("departments", [{ organization_id: legalOrg.id, name: "Filings" }]);
await insert("department_roles", [
  { department_id: filings.id, title: "Compliance Associate", rank: 1, is_manager_level: false },
  { department_id: filings.id, title: "Team Lead", rank: 2, is_manager_level: true },
  { department_id: filings.id, title: "Group Leader", rank: 3, is_manager_level: true },
]);
await insert("leave_types", [
  { organization_id: legalOrg.id, name: "Casual Leave", code: "CL", annual_credit_days: 12, carry_forward_cap: 6 },
  { organization_id: legalOrg.id, name: "Sick Leave", code: "SL", annual_credit_days: 8, carry_forward_cap: 0 },
  { organization_id: legalOrg.id, name: "Earned Leave", code: "EL", annual_credit_days: 18, carry_forward_cap: 15 },
]);
console.log(`   ${LEGAL_STAFF.length} staff, ${LEGAL_CUSTOMERS.length} customers`);
console.log(`   ${await seedHrData("legal", legalOrg.id, LEGAL_STAFF)} attendance events`);

const arvind = await signIn("arvind.menon@legalefilings.com");
for (const c of LEGAL_CATALOG) await post(arvind.api, "/api/product-service-master", c);
console.log(`   ${LEGAL_CATALOG.length} catalog services`);

// ---- 2. Rishabh buys a plan, and pays for it ----
console.log("\n2. Rishabh Khanna buys a CRM plan as a paid customer");
const { order: rkOrder, invoice: rkInvoice } = await post(arvind.api, "/api/orders/buy-for-customer", {
  customerId: ids["rishabhkhanna.93@gmail.com"],
  service: "CRM Workspace — Business Annual Plan", plan: "Business (1 year)", price: 49999,
});
await post(arvind.api, `/api/invoices/${rkInvoice.id}/record-payment`, {
  amount: Number(rkInvoice.total), paymentMode: "Bank Transfer", transactionId: "HDFC/NEFT/771204",
});
console.log(`   order ${rkOrder.id.slice(0, 8)}, invoice ${rkInvoice.invoice_number} paid ₹${Number(rkInvoice.total).toLocaleString("en-IN")}`);
for (const [customer, service, plan, price] of [
  [ids["aarti.deshpande@deshpandetextiles.in"], "Private Limited Company Registration", "Standard", 11999],
  [ids["aarti.deshpande@deshpandetextiles.in"], "Annual ROC Compliance", "FY 2026-27", 14999],
  [ids["imran.shaikh@crescenttraders.co.in"], "GST Registration", "Basic", 1999],
]) await post(arvind.api, "/api/orders/buy-for-customer", { customerId: customer, service, plan, price });
for (const [m, y] of [[6, 2026], [7, 2026]]) await post(arvind.api, "/api/payroll/generate", { month: m, year: y });
console.log("   3 more orders, payroll for Jun + Jul");
await arvind.ctx.close();

// ---- 3 & 4. Request a workspace, platform operator approves ----
console.log("\n3. Rishabh requests a CRM workspace for \"Chatak Singh\"");
const rishabhCustomer = await signIn("rishabhkhanna.93@gmail.com");
await post(rishabhCustomer.api, "/api/crm-access-requests", { organizationName: "Chatak Singh" });
await rishabhCustomer.ctx.close();

console.log("4. Nandini Iyer (platform operator) approves it");
const nandini = await signIn("nandini.iyer@legalefilings.com");
const { requests } = await (await nandini.api.get("/api/crm-access-requests")).json();
const pending = requests.find((r) => r.status === "pending");
const approved = await patch(nandini.api, `/api/platform/crm-access-requests/${pending.id}`, { decision: "approve" });
const chatakId = approved.organization.id;
await nandini.ctx.close();
const { data: promoted } = await supabase.from("profiles").select("account_type, organization_id, customer_tier").eq("id", ids["rishabhkhanna.93@gmail.com"]).single();
console.log(`   -> org "${approved.organization.name}" created; Rishabh is now account_type=${promoted.account_type}, customer_tier=${promoted.customer_tier}`);

// ---- 5. Rishabh sets up his own business ----
console.log("\n5. Rishabh sets up Chatak Singh as its admin");
for (const p of CHATAK_STAFF) await createAccount(p, chatakId, p.account_type);
for (const p of CHATAK_BUYERS) await createAccount(p, chatakId, "customer");
for (const p of CHATAK_STAFF.filter((x) => x.reportsTo)) {
  await supabase.from("profiles").update({ reports_to: ids[p.reportsTo] }).eq("id", ids[p.email]);
}
await supabase.from("profiles").update({
  employee_id: "CS-0001", department: "Management", designation: "Proprietor", date_of_joining: "2022-04-01",
}).eq("id", ids["rishabhkhanna.93@gmail.com"]);
for (const d of [["Sales", [["Sales Executive", 1, false], ["Regional Sales Manager", 2, true], ["Sales Head", 3, true]]],
                 ["Production", [["Machine Operator", 1, false], ["Floor Supervisor", 2, true]]],
                 ["Accounts", [["Accounts Assistant", 1, false], ["Accounts Manager", 2, true]]],
                 ["Dispatch", [["Packing Staff", 1, false], ["Dispatch Incharge", 2, true]]]]) {
  const [dept] = await insert("departments", [{ organization_id: chatakId, name: d[0] }]);
  await insert("department_roles", d[1].map(([title, rank, is_manager_level]) => ({ department_id: dept.id, title, rank, is_manager_level })));
}
console.log(`   ${CHATAK_STAFF.length} staff, ${CHATAK_BUYERS.length} B2B buyers, 4 departments`);
console.log(`   ${await seedHrData("chatak", chatakId, CHATAK_STAFF)} attendance events`);

const rishabh = await signIn("rishabhkhanna.93@gmail.com");
await rishabh.api.patch("/api/business-settings", { data: {
  address: "14/72 Civil Lines, Mall Road, Kanpur, Uttar Pradesh 208001",
  gstNumber: "09AABCC1234D1Z5", panNumber: "AABCC1234D",
  pfNumber: "UP/KNP/0012345", esicNumber: "13000123450000101",
  state: "Uttar Pradesh", stateCode: "09", financialYearStartMonth: 4,
  bankName: "Punjab National Bank", bankAccountNumber: "0123000100456789", bankIfsc: "PUNB0012300",
  bankBranch: "Civil Lines, Kanpur", upiId: "chataksingh@pnb", invoiceNumberPrefix: "CS",
  defaultInvoiceNotes: "Goods once sold will not be taken back. Interest @18% p.a. applies on bills overdue beyond 30 days. Subject to Kanpur jurisdiction.",
} });
for (const c of CHATAK_CATALOG) await post(rishabh.api, "/api/product-service-master", c);
await post(rishabh.api, "/api/company-gst-registrations", {
  label: "Delhi Depot", gstNumber: "07AABCC1234D1ZH", panNumber: "AABCC1234D",
  address: "Unit 7, Naraina Industrial Area Phase-1, New Delhi 110028", state: "Delhi", stateCode: "07",
});
console.log(`   business settings + ${CHATAK_CATALOG.length} catalog items + Delhi depot GSTIN`);

const { customers } = await (await rishabh.api.get("/api/customers")).json();
const buyer = (n) => customers.find((c) => c.full_name === n);
const balaji = buyer("Naresh Agarwal"), gupta = buyer("Sunil Gupta"), anmol = buyer("Deepak Anand"), rajwadi = buyer("Meena Chauhan");
const { items: cat } = await (await rishabh.api.get("/api/product-service-master")).json();
const sku = (name) => {
  const c = cat.find((x) => x.name === name);
  return { catalogItemId: c.id, description: c.name, hsnSacCode: c.hsn_sac_code, unit: c.unit, gstRate: Number(c.gst_rate), rate: Number(c.default_rate), itemType: c.type };
};

for (const [customer, service, plan, price] of [
  [balaji, "Monthly Mukhwas Supply — Assorted 50kg", "Retail Counter Pack", 18500],
  [gupta, "Festive Gift Tin Consignment", "Diwali Season 2026", 42750],
  [anmol, "Bulk Saunf & Supari Supply", "Wholesale Quarterly", 67400],
]) await post(rishabh.api, "/api/orders/buy-for-customer", { customerId: customer.id, service, plan, price });

const made = {};
made.intra = (await post(rishabh.api, "/api/invoices", { customerId: balaji.id, invoiceType: "gst", placeOfSupply: "Uttar Pradesh", paymentTerms: "15 Days",
  notes: "Delivered by our own vehicle, Kanpur city.",
  items: [{ ...sku("Roasted Saunf Mukhwas"), quantity: 25 }, { ...sku("Meethi Supari"), quantity: 10 }] })).invoice;
made.mixed = (await post(rishabh.api, "/api/invoices", { customerId: gupta.id, invoiceType: "gst", placeOfSupply: "Uttar Pradesh", paymentTerms: "30 Days",
  discountType: "flat", discountValue: 500, freight: 1200, packing: 350, notes: "Mixed-slab consignment. Freight billed at actuals.",
  items: [{ ...sku("Plain Fennel Seeds (Saunf)"), quantity: 40 }, { ...sku("Dry Fruit Mukhwas Blend"), quantity: 8 },
          { ...sku("Gulkand Pan Mukhwas"), quantity: 12 }, { ...sku("Mukhwas Gift Tin 500g"), quantity: 60 }] })).invoice;
made.inter = (await post(rishabh.api, "/api/invoices", { customerId: anmol.id, invoiceType: "gst", placeOfSupply: "Delhi", paymentTerms: "30 Days", courier: 900,
  notes: "Dispatched via transport to Karol Bagh godown.",
  items: [{ ...sku("Silver Coated Elaichi Mukhwas"), quantity: 5 }, { ...sku("Chocolate Coated Saunf"), quantity: 15 }, { ...sku("Mixed Mukhwas Special"), quantity: 30 }] })).invoice;
made.tds = (await post(rishabh.api, "/api/invoices", { customerId: rajwadi.id, invoiceType: "gst", placeOfSupply: "Rajasthan", paymentTerms: "45 Days", tdsRate: 2,
  notes: "TDS @2% deducted by buyer under section 194Q.",
  items: [{ ...sku("Dhaniya Dal Mukhwas"), quantity: 50 }, { ...sku("Private Label Packing"), quantity: 500 }] })).invoice;
made.nonGst = (await post(rishabh.api, "/api/invoices", { customerId: balaji.id, invoiceType: "non_gst", paymentTerms: "Immediate",
  notes: "Counter sale, no GST charged.", items: [{ ...sku("Roasted Saunf Mukhwas"), quantity: 5 }] })).invoice;
made.proforma = (await post(rishabh.api, "/api/invoices", { customerId: anmol.id, invoiceType: "proforma", placeOfSupply: "Delhi", paymentTerms: "Advance",
  notes: "Quotation valid for 15 days from date of issue.", items: [{ ...sku("Mukhwas Gift Tin 500g"), quantity: 250 }] })).invoice;
made.credit = (await post(rishabh.api, "/api/invoices", { customerId: balaji.id, invoiceType: "credit_note", relatedInvoiceId: made.intra.id,
  placeOfSupply: "Uttar Pradesh", notes: "Credit for 3kg short supplied against invoice above.",
  items: [{ ...sku("Roasted Saunf Mukhwas"), quantity: 3 }] })).invoice;
made.debit = (await post(rishabh.api, "/api/invoices", { customerId: anmol.id, invoiceType: "debit_note", relatedInvoiceId: made.inter.id,
  placeOfSupply: "Delhi", notes: "Rate revision on elaichi mukhwas as agreed on call.",
  items: [{ ...sku("Silver Coated Elaichi Mukhwas"), quantity: 5, rate: 120 }] })).invoice;
for (const [k, v] of Object.entries(made)) console.log(`   ${k.padEnd(9)} ${v.invoice_number.padEnd(20)} ₹${Number(v.total).toLocaleString("en-IN")}`);

const { template } = await post(rishabh.api, "/api/recurring-invoices", {
  customerId: gupta.id, invoiceType: "gst", frequency: "monthly", startDate: iso(new Date()),
  payload: { customerId: gupta.id, invoiceType: "gst", placeOfSupply: "Uttar Pradesh", paymentTerms: "30 Days",
    notes: "Standing monthly order — Aminabad counter.",
    items: [{ ...sku("Mixed Mukhwas Special"), quantity: 20 }, { ...sku("Roasted Saunf Mukhwas"), quantity: 15 }] },
});
await rishabh.api.get(`/api/recurring-invoices/run?templateId=${template.id}`);
await post(rishabh.api, `/api/invoices/${made.intra.id}/record-payment`, { amount: Number(made.intra.total), paymentMode: "Bank Transfer", transactionId: "PNB/NEFT/884120" });
await post(rishabh.api, `/api/invoices/${made.mixed.id}/record-payment`, { amount: 20000, paymentMode: "UPI", transactionId: "UPI/2026081145213" });
for (const [m, y] of [[6, 2026], [7, 2026]]) {
  const out = await post(rishabh.api, "/api/payroll/generate", { month: m, year: y });
  console.log(`   payroll ${y}-${String(m).padStart(2, "0")}: ${out.generated ?? 0} payslips`);
}

const { data: chatakLeaveTypes } = await supabase.from("leave_types").select("id, code").eq("organization_id", chatakId);
const lt = (code) => chatakLeaveTypes.find((t) => t.code === code)?.id ?? null;
await insert("leave_requests", [
  { organization_id: chatakId, staff_id: ids["sahil.bhatia@chataksingh.in"], leave_type: "casual", leave_type_id: lt("CL"), start_date: iso(daysFromNow(6)), end_date: iso(daysFromNow(7)), reason: "Cousin's wedding in Lucknow", status: "pending", day_fraction: 1 },
  { organization_id: chatakId, staff_id: ids["nusrat.ali@chataksingh.in"], leave_type: "sick", leave_type_id: lt("SL"), start_date: iso(daysFromNow(-12)), end_date: iso(daysFromNow(-11)), reason: "Viral fever, doctor advised rest", status: "approved", reviewed_by: ids["vikas.dwivedi@chataksingh.in"], day_fraction: 1 },
  { organization_id: chatakId, staff_id: ids["anjali.verma@chataksingh.in"], leave_type: "casual", leave_type_id: lt("CL"), start_date: iso(daysFromNow(-25)), end_date: iso(daysFromNow(-24)), reason: "Personal work", status: "rejected", reviewed_by: ids["vikas.dwivedi@chataksingh.in"], review_note: "Peak dispatch week before Raksha Bandhan — please reschedule.", day_fraction: 1 },
]);
await insert("account_requests", [{ organization_id: chatakId, full_name: "Priyanka Nigam", email: "priyanka.nigam@chataksingh.in",
  phone: "+91 94155 33810", requested_account_type: "staff", requested_staff_level: "rater",
  message: "Joining the Kanpur dispatch desk from the 1st — referred by Vikas.", status: "pending" }]);
await rishabh.ctx.close();
await browser.close();

console.log(`\nDone. Password for every account: ${DEMO_PASSWORD}\n`);
console.log("  CHATAK SINGH (Kanpur — mukhwas manufacturer)");
console.log("    rishabhkhanna.93@gmail.com        Rishabh Khanna    ADMIN (was a paid customer, promoted on CRM approval)");
console.log("    manpreet.kaur@chataksingh.in      Manpreet Kaur     staff / group_leader");
console.log("    vikas.dwivedi@chataksingh.in      Vikas Dwivedi     staff / leader");
console.log("    anjali.verma@chataksingh.in       Anjali Verma      staff / rater");
console.log("    sahil.bhatia@chataksingh.in       Sahil Bhatia      staff / rater");
console.log("    nusrat.ali@chataksingh.in         Nusrat Ali        staff / rater");
console.log("    naresh.agarwal@shreebalajistores.in / sunil.gupta@guptakirana.co.in");
console.log("    deepak.anand@anmolsweets.in / meena.chauhan@rajwadistores.in   (B2B buyers, customers)");
console.log("  LEGAL EFILINGS (New Delhi — the provider)");
console.log("    nandini.iyer@legalefilings.com    Nandini Iyer      admin + PLATFORM OPERATOR");
console.log("    arvind.menon@legalefilings.com    Arvind Menon      admin");
console.log("    kavya.reddy@legalefilings.com     Kavya Reddy       staff / group_leader");
console.log("    farhan.qureshi@legalefilings.com  Farhan Qureshi    staff / leader");
console.log("    sneha.kulkarni@legalefilings.com  Sneha Kulkarni    staff / rater");
console.log("    aarti.deshpande@deshpandetextiles.in / imran.shaikh@crescenttraders.co.in   (customers)");
