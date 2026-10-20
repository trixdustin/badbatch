"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const storageKey = "bad-batch-cart";

export type CartProduct = {
  id: string;
  name: string;
  slug: string;
  image: string;
  price: string;
  isSeasonal: boolean;
  subtitle?: string;
  category?: string;
};

export type CartLine = CartProduct & { quantity: number };

type CartContextValue = {
  items: CartLine[];
  itemCount: number;
  hydrated: boolean;
  addItem: (product: CartProduct, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const listeners = new Set<() => void>();
const emptyCart: CartLine[] = [];

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.id === "string" &&
    typeof line.name === "string" &&
    typeof line.slug === "string" &&
    typeof line.image === "string" &&
    typeof line.price === "string" &&
    typeof line.isSeasonal === "boolean" &&
    typeof line.quantity === "number" &&
    Number.isInteger(line.quantity) &&
    line.quantity >= 1 &&
    line.quantity <= 20
  );
}

function readStoredCart(value: string | null): CartLine[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
  } catch {
    return [];
  }
}

function readInitialCart(): CartLine[] | null {
  if (typeof window === "undefined") return null;
  try {
    return readStoredCart(window.localStorage.getItem(storageKey));
  } catch (error) {
    console.error("Unable to load the saved BAD BATCH cart.", error);
    return [];
  }
}

let cartSnapshot = readInitialCart();

function getSnapshot() {
  return cartSnapshot;
}

function getServerSnapshot() {
  return null;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function persistCart(items: CartLine[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  } catch (error) {
    console.error("Unable to save the BAD BATCH cart in this browser.", error);
  }
}

function updateCart(updater: (current: CartLine[]) => CartLine[]) {
  cartSnapshot = updater(cartSnapshot ?? []);
  persistCart(cartSnapshot);
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      cartSnapshot = readStoredCart(event.key === null ? null : event.newValue);
      notify();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const items = snapshot ?? emptyCart;
  const hydrated = snapshot !== null;

  const addItem = useCallback((product: CartProduct, quantity = 1) => {
    updateCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(20, item.quantity + quantity) }
            : item,
        );
      }
      return [...current, { ...product, quantity: Math.min(20, Math.max(1, quantity)) }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    updateCart((current) =>
      quantity <= 0
        ? current.filter((item) => item.id !== productId)
        : current.map((item) =>
            item.id === productId ? { ...item, quantity: Math.min(20, quantity) } : item,
          ),
    );
  }, []);

  const removeItem = useCallback(
    (productId: string) => setQuantity(productId, 0),
    [setQuantity],
  );
  const clearCart = useCallback(() => updateCart(() => []), []);

  const value = useMemo(
    () => ({
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      hydrated,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
    }),
    [items, hydrated, addItem, setQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
}
