// The only two real, hand-written customer testimonials found in the
// WordPress migration export (embedded directly in an Elementor
// testimonial widget on the SSI/MSME page, not the site's "Google
// Reviews" section — that one was a Trustindex plugin shortcode that
// pulls reviews live from Google Business Profile at runtime, so its
// content was never actually stored in the export). Real names, real
// companies, real quotes — nothing paraphrased or invented.
export type Testimonial = {
  name: string;
  role: string;
  quote: string;
  rating: number;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Devanshu Madaan",
    role: "Owner at Varience CyberTech",
    quote:
      "I have good experience with Legal Efilings. They respect their clients and also give directions to those who are new in this field. I love so much their services.",
    rating: 5,
  },
  {
    name: "Tinku Kumar",
    role: "Owner at Midlime Infosystem",
    quote: "Just started my post-incorporation compliances with LegalEFilings and it has been good with prompt & timely resolutions.",
    rating: 5,
  },
];
