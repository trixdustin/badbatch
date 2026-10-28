"use client";

import { useState } from "react";
import { useCart } from "@/components/storefront/cart-provider";
import { formatPhp } from "@/lib/format/currency";
import { COOKIE_SET_RULES, doubleTroublePrice } from "@/lib/storefront/sets";

const standardFlavors = [
  { slug: "the-classic", name: "The Usual", flavor: "Chocolate Chip", regular: 70 },
  { slug: "the-dark", name: "Burn Notice", flavor: "S’mores", regular: 80 },
  { slug: "the-third", name: "White Lie", flavor: "Biscoff White Chocolate", regular: 90 },
];

export function SetsPage({ seasonal }: { seasonal?: { slug: string; name: string; flavor: string; regular: number } }) {
  const flavors = [...standardFlavors, seasonal ?? { slug: "seasonal", name: "After Hours", flavor: "Cookies & Cream", regular: 80 }];
  const { addSet } = useCart();
  const [selected, setSelected] = useState(flavors[0].slug);
  const [added, setAdded] = useState("");
  const price = doubleTroublePrice(selected) ?? 0;
  function add(setId: string, name: string, setPrice: number, contents: { slug: string; quantity: number }[]) {
    addSet({ setId, name: name === "Double Trouble" ? `${name} / ${flavors.find((item) => item.slug === contents[0]?.slug)?.name ?? ""}` : name, price: (setPrice / 100).toFixed(2), contents, image: "" });
    setAdded(setId);
    window.setTimeout(() => setAdded(""), 1800);
  }

  return <div className="py-12 sm:py-16">
    <header className="mb-12 border-b border-[var(--rule)] pb-8">
      <p className="micro-label">the set menu / three ways in</p>
      <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] sm:text-6xl">Made to share. Or not.</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--cream-muted)]">Four current flavors, arranged into a better batch.</p>
    </header>
    <div className="grid gap-5 lg:grid-cols-3">
      <SetCard eyebrow="set 01" title="The Usual, x4" copy="Four of your favorite. No decisions necessary." price={formatPhp(260)} contents="4 × The Usual / Chocolate Chip" comparison={`Usually ${formatPhp(280)} · save ${formatPhp(20)}`} added={added === "usual4"} onAdd={() => add("usual4", COOKIE_SET_RULES.usual4.name, 26000, [...COOKIE_SET_RULES.usual4.contents])} />
      <article className="flex flex-col border border-[var(--rule)] p-6 sm:p-7">
        <p className="micro-label">set 02</p><h2 className="mt-5 text-2xl">Double Trouble</h2>
        <p className="mt-2 text-sm text-[var(--cream-muted)]">Twice the craving. Less to pay.</p>
        <label className="field-label mt-7">choose one flavor
          <select className="field-control mt-2" value={selected} onChange={(event) => setSelected(event.target.value)}>
            {flavors.map((item) => <option key={item.slug} value={item.slug}>{item.name} / {item.flavor}</option>)}
          </select>
        </label>
        <p className="mt-6 text-sm">2 cookies × {flavors.find((item) => item.slug === selected)?.name}</p>
        <div className="mt-auto pt-8"><p className="text-2xl tabular-nums">{formatPhp(price / 100)}</p>
          <p className="mt-2 text-xs text-[var(--cream-muted)]">Regular {formatPhp((flavors.find((item) => item.slug === selected)?.regular ?? 0) * 2)} · save {formatPhp(10)}</p>
          <button className="editorial-button mt-6 w-full" onClick={() => add("doubleTrouble", "Double Trouble", price, [{ slug: selected, quantity: 2 }])} type="button">{added === "doubleTrouble" ? "added to batch" : "add to batch"}</button>
        </div>
      </article>
      <SetCard eyebrow="set 03" title="Full Batch" copy="One of each. The whole current lineup." price={formatPhp(300)} contents={flavors.map((item) => `1 × ${item.name} / ${item.flavor}`).join(" · ")} comparison={`Usually ${formatPhp(320)} · save ${formatPhp(20)}`} added={added === "fullBatch"} onAdd={() => add("fullBatch", COOKIE_SET_RULES.fullBatch.name, 30000, [...COOKIE_SET_RULES.fullBatch.contents.slice(0, 3), { slug: flavors[3].slug, quantity: 1 }])} />
    </div>
  </div>;
}

function SetCard({ eyebrow, title, copy, price, contents, comparison, added, onAdd }: { eyebrow: string; title: string; copy: string; price: string; contents: string; comparison: string; added: boolean; onAdd: () => void }) {
  return <article className="flex flex-col border border-[var(--rule)] p-6 sm:p-7">
    <p className="micro-label">{eyebrow}</p><h2 className="mt-5 text-2xl">{title}</h2>
    <p className="mt-2 text-sm text-[var(--cream-muted)]">{copy}</p>
    <p className="mt-7 text-sm leading-6">{contents}</p>
    <div className="mt-auto pt-8"><p className="text-2xl tabular-nums">{price}</p>
      <p className="mt-2 text-xs text-[var(--cream-muted)]">{comparison}</p>
      <button className="editorial-button mt-6 w-full" onClick={onAdd} type="button">{added ? "added to batch" : "add to batch"}</button>
    </div>
  </article>;
}
