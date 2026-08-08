// Official GST state codes (the 2-digit prefix of a GSTIN) — used to
// auto-derive the "State Code" field from a selected state name instead
// of asking for it as free text, and to compare company vs customer
// state codes to decide CGST+SGST (same state) vs IGST (different state).
export const GST_STATE_CODES: Record<string, string> = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  "Punjab": "03",
  "Chandigarh": "04",
  "Uttarakhand": "05",
  "Haryana": "06",
  "Delhi": "07",
  "Rajasthan": "08",
  "Uttar Pradesh": "09",
  "Bihar": "10",
  "Sikkim": "11",
  "Arunachal Pradesh": "12",
  "Nagaland": "13",
  "Manipur": "14",
  "Mizoram": "15",
  "Tripura": "16",
  "Meghalaya": "17",
  "Assam": "18",
  "West Bengal": "19",
  "Jharkhand": "20",
  "Odisha": "21",
  "Chhattisgarh": "22",
  "Madhya Pradesh": "23",
  "Gujarat": "24",
  "Daman and Diu": "25",
  "Dadra and Nagar Haveli": "26",
  "Maharashtra": "27",
  "Andhra Pradesh": "28",
  "Karnataka": "29",
  "Goa": "30",
  "Lakshadweep": "31",
  "Kerala": "32",
  "Tamil Nadu": "33",
  "Puducherry": "34",
  "Andaman and Nicobar Islands": "35",
  "Telangana": "36",
  "Andhra Pradesh (New)": "37",
  "Ladakh": "38",
};

export function gstStateCode(stateName: string | null | undefined): string {
  if (!stateName) return "";
  return GST_STATE_CODES[stateName] ?? "";
}
