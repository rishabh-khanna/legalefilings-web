export const QUOTE_MODAL_EVENT = "open-quote-modal";

export type QuoteModalDetail = {
  /** Which pricing tier the user picked, if the modal was opened from a plan card. */
  plan?: { name: string; price: string };
  /** Which service the plan belongs to — needed on pages like /pricing that list many services' plans at once, where the modal can't assume one static service. */
  service?: string;
};

export function openQuoteModal(detail?: QuoteModalDetail) {
  window.dispatchEvent(new CustomEvent<QuoteModalDetail>(QUOTE_MODAL_EVENT, { detail }));
}
