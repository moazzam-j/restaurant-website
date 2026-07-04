"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Item = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  image: string;
  sortOrder: number;
  available: boolean;
  featured: boolean;
};

type Category = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
  items: Item[];
};

async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Request failed");
  }
  return res.json();
}

export default function AdminMenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  async function refresh() {
    setError(null);
    try {
      const data = await api("/api/admin/menu");
      setCategories(data.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load menu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial load of the menu catalog on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    await api("/api/admin/menu/categories", {
      method: "POST",
      body: JSON.stringify({ label: newCategoryName.trim() }),
    });
    setNewCategoryName("");
    refresh();
  }

  async function renameCategory(id: string, label: string) {
    await api(`/api/admin/menu/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ label }),
    });
    refresh();
  }

  async function moveCategory(id: string, direction: "up" | "down") {
    await api(`/api/admin/menu/categories/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
    refresh();
  }

  async function deleteCategory(id: string, label: string) {
    if (!window.confirm(`Delete "${label}" and all its items? This can't be undone.`)) return;
    await api(`/api/admin/menu/categories/${id}`, { method: "DELETE" });
    refresh();
  }

  async function patchItem(id: string, data: Record<string, unknown>) {
    await api(`/api/admin/menu/items/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    refresh();
  }

  async function moveItem(id: string, direction: "up" | "down") {
    await api(`/api/admin/menu/items/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
    refresh();
  }

  async function deleteItem(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    await api(`/api/admin/menu/items/${id}`, { method: "DELETE" });
    refresh();
  }

  if (loading) return <div className="px-5 py-6 text-sm text-muted sm:px-8">Loading…</div>;

  return (
    <div className="px-5 py-6 sm:px-8">
      <div className="mb-6">
        <div className="font-display text-2xl text-text">MENU</div>
        <div className="mt-1 text-xs text-muted">
          Edit names, prices and photos. Changes go live on the site immediately.
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

      <div className="flex flex-col gap-6">
        {categories.map((category, catIndex) => (
          <CategoryCard
            key={category.id}
            category={category}
            isFirst={catIndex === 0}
            isLast={catIndex === categories.length - 1}
            onRename={renameCategory}
            onMove={moveCategory}
            onDelete={deleteCategory}
            onItemPatch={patchItem}
            onItemMove={moveItem}
            onItemDelete={deleteItem}
            onItemAdded={refresh}
          />
        ))}
      </div>

      <form
        onSubmit={addCategory}
        className="mt-8 flex max-w-md gap-3 rounded-2xl border border-dashed border-white/12 p-4"
      >
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="New category name"
          className="flex-1 rounded-lg border border-white/9 bg-white/3 px-3 py-2 text-sm text-text placeholder:text-muted focus:border-mustard/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!newCategoryName.trim()}
          className="rounded-lg bg-mustard px-4 py-2 text-xs font-extrabold text-[#100D0A] disabled:opacity-40"
        >
          + Add Category
        </button>
      </form>
    </div>
  );
}

function CategoryCard({
  category,
  isFirst,
  isLast,
  onRename,
  onMove,
  onDelete,
  onItemPatch,
  onItemMove,
  onItemDelete,
  onItemAdded,
}: {
  category: Category;
  isFirst: boolean;
  isLast: boolean;
  onRename: (id: string, label: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onDelete: (id: string, label: string) => void;
  onItemPatch: (id: string, data: Record<string, unknown>) => void;
  onItemMove: (id: string, direction: "up" | "down") => void;
  onItemDelete: (id: string, name: string) => void;
  onItemAdded: () => void;
}) {
  const [label, setLabel] = useState(category.label);

  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-b from-white/3 to-white/1 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => label.trim() && label !== category.label && onRename(category.id, label.trim())}
            className="font-display rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg tracking-wide text-mustard focus:border-mustard/40 focus:bg-white/3 focus:outline-none"
          />
          <span className="text-xs text-muted">{category.items.length} items</span>
        </div>
        <div className="flex items-center gap-2">
          <IconButton disabled={isFirst} onClick={() => onMove(category.id, "up")} label="Move category up">
            ↑
          </IconButton>
          <IconButton disabled={isLast} onClick={() => onMove(category.id, "down")} label="Move category down">
            ↓
          </IconButton>
          <button
            onClick={() => onDelete(category.id, category.label)}
            className="rounded-lg border border-red-500/25 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10"
          >
            Delete category
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {category.items.map((item, i) => (
          <ItemRow
            key={item.id}
            item={item}
            isFirst={i === 0}
            isLast={i === category.items.length - 1}
            onPatch={onItemPatch}
            onMove={onItemMove}
            onDelete={onItemDelete}
          />
        ))}
      </div>

      <AddItemForm categoryId={category.id} onAdded={onItemAdded} />
    </div>
  );
}

function IconButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-xs text-text disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function ItemRow({
  item,
  isFirst,
  isLast,
  onPatch,
  onMove,
  onDelete,
}: {
  item: Item;
  isFirst: boolean;
  isLast: boolean;
  onPatch: (id: string, data: Record<string, unknown>) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [description, setDescription] = useState(item.description ?? "");

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/6 bg-black/15 p-3">
      <Image
        src={item.image}
        alt={item.name}
        width={48}
        height={48}
        className={`h-12 w-12 flex-shrink-0 rounded-lg object-cover ${
          item.available ? "" : "opacity-40 grayscale"
        }`}
      />

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== item.name && onPatch(item.id, { name: name.trim() })}
        className="min-w-[140px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-text focus:border-white/10 focus:bg-white/3 focus:outline-none"
      />

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() =>
          description !== (item.description ?? "") && onPatch(item.id, { description })
        }
        placeholder="Description (optional)"
        className="min-w-[160px] flex-[1.5] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-xs text-muted placeholder:text-muted/60 focus:border-white/10 focus:bg-white/3 focus:outline-none"
      />

      <div className="flex items-center gap-1 text-sm text-mustard">
        Rs
        <input
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => {
            const n = Number(price);
            if (Number.isFinite(n) && n >= 0 && n !== item.price) onPatch(item.id, { price: n });
          }}
          className="w-20 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-bold text-mustard focus:border-white/10 focus:bg-white/3 focus:outline-none"
        />
      </div>

      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
        <input
          type="checkbox"
          checked={item.featured}
          onChange={(e) => onPatch(item.id, { featured: e.target.checked })}
        />
        Featured
      </label>

      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
        <input
          type="checkbox"
          checked={item.available}
          onChange={(e) => onPatch(item.id, { available: e.target.checked })}
        />
        Available
      </label>

      <div className="ml-auto flex items-center gap-1.5">
        <IconButton disabled={isFirst} onClick={() => onMove(item.id, "up")} label="Move item up">
          ↑
        </IconButton>
        <IconButton disabled={isLast} onClick={() => onMove(item.id, "down")} label="Move item down">
          ↓
        </IconButton>
        <button
          onClick={() => onDelete(item.id, item.name)}
          className="rounded-lg border border-red-500/25 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/10"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AddItemForm({ categoryId, onAdded }: { categoryId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price || !file) {
      setError("Name, price and a photo are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error((await uploadRes.json()).error ?? "Upload failed");
      const { url } = await uploadRes.json();

      await api("/api/admin/menu/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name: name.trim(),
          price: Number(price),
          description: description.trim() || undefined,
          image: url,
        }),
      });

      setName("");
      setPrice("");
      setDescription("");
      setFile(null);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/12 p-3"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New item name"
        className="min-w-[140px] flex-1 rounded-lg border border-white/9 bg-white/3 px-2.5 py-2 text-sm text-text placeholder:text-muted focus:border-mustard/50 focus:outline-none"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="min-w-[140px] flex-[1.5] rounded-lg border border-white/9 bg-white/3 px-2.5 py-2 text-xs text-text placeholder:text-muted focus:border-mustard/50 focus:outline-none"
      />
      <input
        type="number"
        min={0}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Price"
        className="w-24 rounded-lg border border-white/9 bg-white/3 px-2.5 py-2 text-sm text-text placeholder:text-muted focus:border-mustard/50 focus:outline-none"
      />
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="max-w-[180px] text-xs text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-white/8 file:px-2.5 file:py-1.5 file:text-xs file:text-text"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-mustard px-4 py-2 text-xs font-extrabold text-[#100D0A] disabled:opacity-40"
      >
        {submitting ? "Adding…" : "+ Add Item"}
      </button>
      {error && <div className="w-full text-xs text-red-400">{error}</div>}
    </form>
  );
}
