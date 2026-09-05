"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateProductForm({ categories }: { categories: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [casNumber, setCasNumber] = useState("");
  const [description, setDescription] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData();
    form.set("name", name);
    form.set("category", category);
    form.set("casNumber", casNumber);
    form.set("description", description);
    form.set("size", size);
    form.set("price", price);
    if (fileRef.current?.files?.[0]) {
      form.set("image", fileRef.current.files[0]);
    }

    const res = await fetch("/api/admin/products", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong adding that product.");
      return;
    }

    setName("");
    setCategory("");
    setCasNumber("");
    setDescription("");
    setSize("");
    setPrice("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px" }}>
          <label htmlFor="newName">Product Name</label>
          <input
            id="newName"
            required
            placeholder="e.g. Oxytocin"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 220px" }}>
          <label htmlFor="newCategory">Category</label>
          <input
            id="newCategory"
            required
            list="existing-categories"
            placeholder="e.g. Neuropeptides"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="existing-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label htmlFor="newCas">CAS Number</label>
          <input
            id="newCas"
            placeholder="optional"
            value={casNumber}
            onChange={(e) => setCasNumber(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="newDescription">Description</label>
        <textarea
          id="newDescription"
          rows={3}
          placeholder="Research/mechanism-focused overview — optional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ width: 130 }}>
          <label htmlFor="newSize">Size</label>
          <input
            id="newSize"
            required
            placeholder="e.g. 10mg"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
        </div>
        <div style={{ width: 130 }}>
          <label htmlFor="newPrice">Price</label>
          <input
            id="newPrice"
            required
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div style={{ flex: "1 1 220px" }}>
          <label htmlFor="newImage">Cover Photo</label>
          <input id="newImage" type="file" accept="image/*" ref={fileRef} />
        </div>
        <button className="btn" type="submit" disabled={saving} style={{ marginBottom: 0 }}>
          {saving ? "Adding…" : "Add Product"}
        </button>
      </div>

      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
    </form>
  );
}
