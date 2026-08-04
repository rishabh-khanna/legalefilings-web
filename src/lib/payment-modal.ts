export const PAYMENT_MODAL_EVENT = "open-payment-modal";

export type PaymentModalDetail = {
  plan: { name: string; price: string };
  service: string;
};

export function openPaymentModal(detail: PaymentModalDetail) {
  window.dispatchEvent(new CustomEvent<PaymentModalDetail>(PAYMENT_MODAL_EVENT, { detail }));
}
