export const ENTITY_FINDER_MODAL_EVENT = "open-entity-finder-modal";

export function openEntityFinderModal() {
  window.dispatchEvent(new Event(ENTITY_FINDER_MODAL_EVENT));
}
