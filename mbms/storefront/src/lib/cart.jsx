import React, { createContext, useContext, useEffect, useState } from 'react';

// Sprint 16 (Customer Storefront) — cart is client-side only (this
// Context, persisted to localStorage), matching the plan's own judgment
// call: there's nothing to model server-side until checkout turns it into
// a real Order (see OrdersService.createForCustomer in the backend).
const CartContext = createContext(undefined);
const CART_KEY = 'storefront.cart';

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => loadCart());

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  function addItem(product, quantity) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: Number(product.unitPrice),
          quantity,
          // Group catalogue (29 August 2026): remember which subsidiary and
          // branch this line came from, so the cart can group by seller and
          // checkout can place one order per subsidiary.
          companyId: product.companyId ?? null,
          companyName: product.companyName ?? null,
          branchId: product.branchId ?? null,
          branchName: product.branchName ?? null,
        },
      ];
    });
  }

  function setQuantity(productId, quantity) {
    setItems((prev) =>
      quantity <= 0 ? prev.filter((i) => i.productId !== productId) : prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    );
  }

  function removeItem(productId) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function clear() {
    setItems([]);
  }

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  // Group catalogue (29 August 2026): the cart split by selling subsidiary.
  // Each group becomes its own order at checkout ("items ship separately per
  // company" — see the mockups' cart screen).
  const groups = Object.values(
    items.reduce((acc, i) => {
      const key = i.companyId || '__unknown__';
      if (!acc[key]) {
        acc[key] = { companyId: i.companyId || null, companyName: i.companyName || null, items: [], subtotal: 0 };
      }
      acc[key].items.push(i);
      acc[key].subtotal += i.unitPrice * i.quantity;
      return acc;
    }, {}),
  ).sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));

  return (
    <CartContext.Provider value={{ items, groups, addItem, setQuantity, removeItem, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
