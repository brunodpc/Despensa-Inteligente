export const SHOPPING_LIST_CHANGED = 'despensa:shopping-list-changed'

export function notifyShoppingListChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SHOPPING_LIST_CHANGED))
}
