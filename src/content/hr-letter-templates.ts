// The 11 templates from the HRMS spec. Each template declares the extra
// fields it needs beyond the common ones (employee name, designation,
// department, date) and a pure function producing the letter body as an
// array of paragraphs — kept as plain data + functions (no DB table)
// since a letter is generated on demand from current employee data, not
// stored as its own editable record.
export type LetterField = { key: string; label: string; type: "text" | "date" | "number" | "textarea" };

export type LetterTemplate = {
  slug: string;
  name: string;
  fields: LetterField[];
  subject: (f: Record<string, string>) => string;
  body: (f: Record<string, string>, companyName: string, todayLabel: string) => string[];
};

const COMMON_FIELDS: LetterField[] = [
  { key: "employeeName", label: "Employee Name", type: "text" },
  { key: "designation", label: "Designation", type: "text" },
  { key: "department", label: "Department", type: "text" },
];

export const HR_LETTER_TEMPLATES: LetterTemplate[] = [
  {
    slug: "offer-letter",
    name: "Offer Letter",
    fields: [...COMMON_FIELDS, { key: "joiningDate", label: "Proposed Joining Date", type: "date" }, { key: "annualCtc", label: "Annual CTC (₹)", type: "number" }],
    subject: () => "Offer of Employment",
    body: (f, company, today) => [
      `Dear ${f.employeeName},`,
      `We are pleased to offer you the position of ${f.designation} in the ${f.department} department at ${company}, effective from ${f.joiningDate}.`,
      `Your annual Cost to Company (CTC) will be ₹${f.annualCtc}, subject to applicable statutory deductions. A detailed salary breakup will be shared separately in your appointment letter.`,
      `Please confirm your acceptance of this offer by signing and returning a copy of this letter. We look forward to welcoming you to the team.`,
      `Sincerely,`,
      `${company}`,
      `Date: ${today}`,
    ],
  },
  {
    slug: "appointment-letter",
    name: "Appointment Letter",
    fields: [...COMMON_FIELDS, { key: "joiningDate", label: "Date of Joining", type: "date" }, { key: "annualCtc", label: "Annual CTC (₹)", type: "number" }],
    subject: () => "Letter of Appointment",
    body: (f, company, today) => [
      `Dear ${f.employeeName},`,
      `Further to your acceptance of our offer, we are pleased to confirm your appointment as ${f.designation} in the ${f.department} department at ${company}, with effect from ${f.joiningDate}.`,
      `Your annual CTC will be ₹${f.annualCtc}. Your employment will be governed by the company's HR policies as amended from time to time.`,
      `We welcome you to ${company} and look forward to a successful association.`,
      `Sincerely,`,
      `${company}`,
      `Date: ${today}`,
    ],
  },
  {
    slug: "joining-letter",
    name: "Joining Letter",
    fields: [...COMMON_FIELDS, { key: "joiningDate", label: "Date of Joining", type: "date" }],
    subject: () => "Confirmation of Joining",
    body: (f, company, today) => [
      `Dear ${f.employeeName},`,
      `This is to confirm that you have joined ${company} as ${f.designation} in the ${f.department} department on ${f.joiningDate}.`,
      `We are glad to have you on board and look forward to your contributions.`,
      `Sincerely,`,
      `${company}`,
      `Date: ${today}`,
    ],
  },
  {
    slug: "experience-letter",
    name: "Experience Letter",
    fields: [...COMMON_FIELDS, { key: "joiningDate", label: "Date of Joining", type: "date" }, { key: "lastWorkingDay", label: "Last Working Day", type: "date" }],
    subject: () => "Experience Certificate",
    body: (f, company, today) => [
      `To Whomsoever It May Concern,`,
      `This is to certify that ${f.employeeName} was employed with ${company} as ${f.designation} in the ${f.department} department from ${f.joiningDate} to ${f.lastWorkingDay}.`,
      `During this period, we found ${f.employeeName} to be sincere, hardworking, and professional. We wish them the very best in their future endeavors.`,
      `Sincerely,`,
      `${company}`,
      `Date: ${today}`,
    ],
  },
  {
    slug: "promotion-letter",
    name: "Promotion Letter",
    fields: [...COMMON_FIELDS, { key: "oldDesignation", label: "Previous Designation", type: "text" }, { key: "effectiveDate", label: "Effective Date", type: "date" }],
    subject: () => "Letter of Promotion",
    body: (f, company, today) => [
      `Dear ${f.employeeName},`,
      `We are pleased to inform you that, in recognition of your consistent performance and contribution, you have been promoted from ${f.oldDesignation} to ${f.designation} in the ${f.department} department, effective ${f.effectiveDate}.`,
      `Congratulations on this achievement — we look forward to your continued growth with ${company}.`,
      `Sincerely,`,
      `${company}`,
      `Date: ${today}`,
    ],
  },
  {
    slug: "salary-increment-letter",
    name: "Salary Increment Letter",
    fields: [...COMMON_FIELDS, { key: "oldSalary", label: "Previous Annual CTC (₹)", type: "number" }, { key: "newSalary", label: "Revised Annual CTC (₹)", type: "number" }, { key: "effectiveDate", label: "Effective Date", type: "date" }],
    subject: () => "Salary Revision",
    body: (f, company, today) => [
      `Dear ${f.employeeName},`,
      `We are pleased to inform you that your annual CTC as ${f.designation} in the ${f.department} department has been revised from ₹${f.oldSalary} to ₹${f.newSalary}, effective ${f.effectiveDate}.`,
      `This revision reflects your performance and contribution to the team. A detailed revised salary breakup will follow separately.`,
      `Congratulations, and thank you for your continued commitment to ${company}.`,
      `Sincerely,`,
      `${company}`,
      `Date: ${today}`,
    ],
  },
  {
    slug: "relieving-letter",
    name: "Relieving Letter",
    fields: [...COMMON_FIELDS, { key: "joiningDate", label: "Date of Joining", type: "date" }, { key: "lastWorkingDay", label: "Last Working Day", type: "date" }],
    subject: () => "Relieving Letter",
    body: (f, company, today) => [
      `Dear ${f.employeeName},`,
      `This is to confirm that you were employed with ${company} as ${f.designation} in the ${f.department} department from ${f.joiningDate}, and that you have been relieved of your duties with effect from ${f.lastWorkingDay}.`,
      `All dues, if any, will be settled as per company policy. We thank you for your contribution and wish you success in your future endeavors.`,
      `Sincerely,`,
      `${company}`,
      `Date: ${today}`,
    ],
  },
  {
    slug: "termination-letter",
    name: "Termination Letter",
    fields: [...COMMON_FIELDS, { key: "terminationDate", label: "Termination Effective Date", type: "date" }, { key: "reason", label: "Reason (brief)", type: "textarea" }],
    subject: () => "Termination of Employment",
    body: (f, company, today) => [
      `Dear ${f.employeeName},`,
      `This letter is to inform you that your employment with ${company} as ${f.designation} in the ${f.department} department will stand terminated with effect from ${f.terminationDate}.`,
      `Reason: ${f.reason}`,
      `Please coordinate with HR regarding the handover of company property, final settlement, and any other formalities.`,
      `Sincerely,`,
      `${company}`,
      `Date: ${today}`,
    ],
  },
  {
    slug: "warning-letter",
    name: "Warning Letter",
    fields: [...COMMON_FIELDS, { key: "incidentDate", label: "Date of Incident", type: "date" }, { key: "warningReason", label: "Details of Concern", type: "textarea" }],
    subject: () => "Letter of Warning",
    body: (f, company, today) => [
      `Dear ${f.employeeName},`,
      `This letter serves as a formal warning regarding the following matter observed on ${f.incidentDate}:`,
      `${f.warningReason}`,
      `You are advised to take corrective action immediately. Continued conduct of this nature may result in further disciplinary action, up to and including termination of employment.`,
      `Sincerely,`,
      `${company}`,
      `Date: ${today}`,
    ],
  },
  {
    slug: "internship-certificate",
    name: "Internship Certificate",
    fields: [...COMMON_FIELDS, { key: "internshipStartDate", label: "Internship Start Date", type: "date" }, { key: "internshipEndDate", label: "Internship End Date", type: "date" }],
    subject: () => "Internship Completion Certificate",
    body: (f, company, today) => [
      `To Whomsoever It May Concern,`,
      `This is to certify that ${f.employeeName} completed an internship with ${company} as ${f.designation} in the ${f.department} department, from ${f.internshipStartDate} to ${f.internshipEndDate}.`,
      `During this period, ${f.employeeName} demonstrated dedication and a strong learning attitude. We wish them success in their future endeavors.`,
      `Sincerely,`,
      `${company}`,
      `Date: ${today}`,
    ],
  },
  {
    slug: "internship-offer-letter",
    name: "Internship Offer Letter",
    fields: [...COMMON_FIELDS, { key: "internshipStartDate", label: "Internship Start Date", type: "date" }, { key: "internshipDuration", label: "Duration (e.g. 3 months)", type: "text" }, { key: "stipend", label: "Monthly Stipend (₹, optional)", type: "text" }],
    subject: () => "Internship Offer",
    body: (f, company, today) => [
      `Dear ${f.employeeName},`,
      `We are pleased to offer you an internship position as ${f.designation} in the ${f.department} department at ${company}, starting ${f.internshipStartDate} for a duration of ${f.internshipDuration}.`,
      f.stipend ? `You will receive a monthly stipend of ₹${f.stipend} during the internship period.` : `Details of the internship terms will be shared upon your acceptance.`,
      `Please confirm your acceptance by replying to this letter. We look forward to having you on our team.`,
      `Sincerely,`,
      `${company}`,
      `Date: ${today}`,
    ],
  },
];

export function getLetterTemplate(slug: string) {
  return HR_LETTER_TEMPLATES.find((t) => t.slug === slug);
}
