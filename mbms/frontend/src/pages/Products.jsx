import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function ProductsPage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasRole('Super Administrator', 'Sales Manager', 'Procurement Manager') || hasPermission('product.manage');

  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setError(null);
    try {
      const { items } = await apiRequestWithMeta('/products', { pageSize: 100 });
      setProducts(items);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load products.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Layout>
      <div className="pagehead">
        <div>
          <div className="crumbs">Products</div>
          <h1>Products</h1>
        </div>
        {canManage && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Product
            </button>
          </div>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="card">
        {products === null ? (
          <div className="loading">Loading…</div>
        ) : products.length === 0 ? (
          <div className="empty">No products to show.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Product</th>
                <th>Type</th>
                <th>Category</th>
                <th>UoM</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.productCode}</td>
                  <td className="rowlink">{p.name}</td>
                  <td>{p.productType === 'service' ? 'Service' : 'Good'}</td>
                  <td>{p.categoryName || '—'}</td>
                  <td>{p.unitOfMeasure || '—'}</td>
                  <td><Money value={p.unitPrice} /></td>
                  <td>
                    <span className={`badge ${p.status === 'active' ? 'success' : 'neutral'}`}>
                      <span className="dot" />
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateProductModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </Layout>
  );
}

function CreateProductModal({ onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [productType, setProductType] = useState('good');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('');
  const [barcode, setBarcode] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  async function loadCategories() {
    if (!companyId) return;
    setLoadingCategories(true);
    setError(null);
    try {
      const data = await apiRequest('/product-categories', { query: { companyId } });
      setCategories(data);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load categories for that company.');
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }

  async function addCategory() {
    if (!companyId || !newCategoryName) return;
    setError(null);
    try {
      const created = await apiRequest('/product-categories', {
        method: 'POST',
        body: { companyId, name: newCategoryName },
      });
      setCategories((prev) => [...prev, created]);
      setCategoryId(created.id);
      setNewCategoryName('');
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create category.');
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/products', {
        method: 'POST',
        body: {
          companyId,
          categoryId: categoryId || undefined,
          productCode,
          productType,
          name,
          description: description || undefined,
          unitOfMeasure: unitOfMeasure || undefined,
          barcode: barcode || undefined,
          unitPrice: unitPrice || undefined,
          stockQuantity: stockQuantity ? Number(stockQuantity) : undefined,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to create product.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h2>New Product</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Company ID <span className="req">*</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="uuid"
                required
              />
              <button type="button" className="btn btn-secondary" onClick={loadCategories} disabled={!companyId}>
                {loadingCategories ? 'Loading…' : 'Load Categories'}
              </button>
            </div>
          </div>

          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Product Code *</label>
              <input className="input" value={productCode} onChange={(e) => setProductCode(e.target.value)} required />
            </div>
            <div className="field">
              <label>Type</label>
              <select className="select" value={productType} onChange={(e) => setProductType(e.target.value)}>
                <option value="good">Good</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div className="field">
              <label>Unit of Measure</label>
              <input className="input" value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} placeholder="e.g. Bag, Piece" />
            </div>
            <div className="field">
              <label>Barcode</label>
              <input className="input" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </div>
            <div className="field">
              <label>Unit Price (UGX)</label>
              <input className="input" type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="e.g. 210000" />
            </div>
            <div className="field">
              <label>Stock Quantity</label>
              <input className="input" type="number" min="0" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Description</label>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 8 }}>
            <label>Category</label>
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— none —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="input"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
            />
            <button type="button" className="btn btn-secondary" onClick={addCategory} disabled={!companyId || !newCategoryName}>
              + Add
            </button>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
