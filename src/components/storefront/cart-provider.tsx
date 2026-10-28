"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
export type CartSetLine = { id: string; setId: string; name: string; price: string; quantity: number; image: string; contents: { slug: string; quantity: number }[] };
export type CartEntry = CartLine | CartSetLine;

type CartContextValue = {
  items: CartEntry[];
  itemCount: number;
  hydrated: boolean;
  addItem: (product: CartProduct, quantity?: number) => void;
  addSet: (set: Omit<CartSetLine, "id" | "quantity">) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const listeners = new Set<() => void>();
const emptyCart: CartEntry[] = [];
type CartSnapshot = { items: CartEntry[]; hydrated: boolean };
const serverSnapshot: CartSnapshot = { items: emptyCart, hydrated: false };

function isCartLine(value: unknown): value is CartEntry {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.id === "string" &&
    (typeof line.setId === "string" || typeof line.slug === "string") &&
    typeof line.name === "string" &&
    (typeof line.setId === "string" || typeof line.slug === "string") &&
    typeof line.image === "string" &&
    typeof line.price === "string" &&
    (typeof line.setId === "string" || typeof line.isSeasonal === "boolean") &&
    (typeof line.setId !== "string" || (Array.isArray(line.contents) && line.contents.every((part) => typeof part === "object" && part !== null && typeof (part as Record<string, unknown>).slug === "string" && Number.isInteger((part as Record<string, unknown>).quantity)))) &&
    typeof line.quantity === "number" &&
    Number.isInteger(line.quantity) &&
    line.quantity >= 1 &&
    line.quantity <= 20
  );
}

function readStoredCart(value: string | null): CartEntry[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
  } catch {
    return [];
  }
}

function readBrowserCart(): CartEntry[] {
  try {
    return readStoredCart(window.localStorage.getItem(storageKey));
  } catch (error) {
    console.error("Unable to load the saved BAD BATCH cart.", error);
    return [];
  }
}

let cartSnapshot = serverSnapshot;

function getSnapshot() {
  return cartSnapshot;
}

function getServerSnapshot() {
  return serverSnapshot;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function persistCart(items: CartEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  } catch (error) {
    console.error("Unable to save the BAD BATCH cart in this browser.", error);
  }
}

function updateCart(updater: (current: CartEntry[]) => CartEntry[]) {
  const current = cartSnapshot.hydrated ? cartSnapshot.items : readBrowserCart();
  cartSnapshot = { items: updater(current), hydrated: true };
  persistCart(cartSnapshot.items);
  notify();
}

function hydrateCart() {
  if (cartSnapshot.hydrated) return;
  cartSnapshot = { items: readBrowserCart(), hydrated: true };
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      cartSnapshot = {
        items: readStoredCart(event.key === null ? null : event.newValue),
        hydrated: true,
      };
      notify();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { items, hydrated } = snapshot;

  useEffect(() => {
    hydrateCart();
  }, []);

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

  const addSet = useCallback((set: Omit<CartSetLine, "id" | "quantity">) => {
    updateCart((current) => [...current, { ...set, id: `set-${crypto.randomUUID()}`, quantity: 1 }]);
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
      itemCount: items.reduce((total, item) => total + item.quantity * ("contents" in item ? item.contents.reduce((count, part) => count + part.quantity, 0) : 1), 0),
      hydrated,
      addItem,
      addSet,
      setQuantity,
      removeItem,
      clearCart,
    }),
    [items, hydrated, addItem, addSet, setQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
}
