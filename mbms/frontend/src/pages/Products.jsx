import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Money } from '../components/Money';
import { apiRequest, apiRequestWithMeta, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Product Manager (5 September 2026): the group now has seven companies and
// twenty-six branches, so a product row's owning subsidiary and producing
// branch are shown as columns, the list can be filtered to one subsidiary,
// and registering a product picks its company and branch from dropdowns
// rather than asking an administrator to paste a company UUID.
export function ProductsPage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasRole('Super Administrator', 'Sales Manager', 'Procurement Manager') || hasPermission('product.manage');

  const [products, setProducts] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editRow, setEditRow] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { items } = await apiRequestWithMeta('/organization/companies', { pageSize: 100 });
        setCompanies(items);
      } catch {
        // A branch-scoped user has no group-wide company list — the
        // dropdowns then simply stay empty and the API still scopes the
        // product list to what they may see.
        setCompanies([]);
      }
    })();
  }, []);

  async function load() {
    setError(null);
    try {
      const query = { pageSize: 100 };
      if (companyFilter) query['filter[companyId]'] = companyFilter;
      const { items } = await apiRequestWithMeta('/products', query);
      setProducts(items);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to load products.');
    }
  }

  useEffect(() => {
    setProducts(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilter]);

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

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field" style={{ maxWidth: 380 }}>
          <label>Subsidiary</label>
          <select className="select" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="">— all companies in my scope —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

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
                <th>Company</th>
                <th>Branch</th>
                <th>Type</th>
                <th>Category</th>
                <th>UoM</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.productCode}</td>
                  <td className="rowlink">{p.name}</td>
                  <td>{p.companyName || '—'}</td>
                  <td>{p.branchName || <span style={{ opacity: 0.6 }}>Company-wide</span>}</td>
                  <td>{p.productType === 'service' ? 'Service' : 'Good'}</td>
                  <td>{p.categoryName || '—'}</td>
                  <td>{p.unitOfMeasure || '—'}</td>
                  <td>
                    {p.unitPrice === null ? (
                      <span style={{ opacity: 0.6 }}>Internal — not sold</span>
                    ) : (
                      <Money value={p.unitPrice} />
                    )}
                  </td>
                  <td className="mono">{p.stockQuantity ?? '—'}</td>
                  <td>
                    <span className={`badge ${p.status === 'active' ? 'success' : 'neutral'}`}>
                      <span className="dot" />
                      {p.status}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditRow(p)}>
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateProductModal companies={companies} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      {editRow && (
        <EditProductModal product={editRow} onClose={() => setEditRow(null)} onSaved={load} />
      )}
    </Layout>
  );
}

// Loads the categories and branches of one company, so both the create and
// the edit modal offer only references that belong to the product's own
// subsidiary — the API rejects a cross-company category or branch.
function useCompanyReferences(companyId) {
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setCategories([]);
      setBranches([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [cats, brs] = await Promise.all([
          apiRequest('/product-categories', { query: { companyId } }).catch(() => []),
          apiRequest(`/organization/companies/${companyId}/branches`).catch(() => []),
        ]);
        if (cancelled) return;
        setCategories(Array.isArray(cats) ? cats : []);
        setBranches(Array.isArray(brs) ? brs : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { categories, setCategories, branches, loading };
}

function CreateProductModal({ companies, onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('');
  const { categories, setCategories, branches, loading } = useCompanyReferences(companyId);
  const [categoryId, setCategoryId] = useState('');
  const [branchId, setBranchId] = useState('');
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

  // Changing company invalidates whatever category / branch was picked
  // under the previous one.
  useEffect(() => {
    setCategoryId('');
    setBranchId('');
  }, [companyId]);

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
          branchId: branchId || undefined,
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
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2>New Product</h2>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>
                Company <span className="req">*</span>
              </label>
              <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
                <option value="">— select a subsidiary —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Branch / Site</label>
              <select
                className="select"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={!companyId || loading}
              >
                <option value="">{loading ? 'Loading…' : '— company-wide —'}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
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
              <input className="input" value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} placeholder="e.g. Bag (50 kg), Ton" />
            </div>
            <div className="field">
              <label>Barcode</label>
              <input className="input" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </div>
            <div className="field">
              <label>Unit Price (UGX)</label>
              <input className="input" type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="blank = internal, not sold" />
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
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!companyId || loading}
            >
              <option value="">{loading ? 'Loading…' : '— none —'}</option>
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
            <button type="submit" className="btn btn-primary" disabled={saving || !companyId}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// PATCH /products/{id} has existed since Sprint 4 but had no screen — an
// administrator could register a product and then never correct its price,
// re-point it at another mill or retire it. This is that screen. The product
// code and owning company are immutable (the code is the company-unique key
// other records reference), so they are shown read-only.
function EditProductModal({ product, onClose, onSaved }) {
  const { categories, branches, loading } = useCompanyReferences(product.companyId);
  const [categoryId, setCategoryId] = useState(product.categoryId ?? '');
  const [branchId, setBranchId] = useState(product.branchId ?? '');
  const [productType, setProductType] = useState(product.productType ?? 'good');
  const [name, setName] = useState(product.name ?? '');
  const [description, setDescription] = useState(product.description ?? '');
  const [unitOfMeasure, setUnitOfMeasure] = useState(product.unitOfMeasure ?? '');
  const [barcode, setBarcode] = useState(product.barcode ?? '');
  const [unitPrice, setUnitPrice] = useState(product.unitPrice ?? '');
  const [stockQuantity, setStockQuantity] = useState(product.stockQuantity ?? '');
  const [status, setStatus] = useState(product.status ?? 'active');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/products/${product.id}`, {
        method: 'PATCH',
        body: {
          categoryId: categoryId || undefined,
          branchId: branchId || undefined,
          productType,
          name,
          description: description || undefined,
          unitOfMeasure: unitOfMeasure || undefined,
          barcode: barcode || undefined,
          unitPrice: unitPrice === '' ? undefined : String(unitPrice),
          stockQuantity: stockQuantity === '' ? undefined : Number(stockQuantity),
          status,
        },
      });
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.apiError.message);
      else setError('Unable to update product.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2>Edit Product</h2>
        <div className="muted" style={{ marginBottom: 12 }}>
          <span className="mono">{product.productCode}</span> — {product.companyName}
        </div>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="formgrid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Branch / Site</label>
              <select className="select" value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={loading}>
                <option value="">{loading ? 'Loading…' : '— company-wide —'}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Category</label>
              <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={loading}>
                <option value="">{loading ? 'Loading…' : '— none —'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Type</label>
              <select className="select" value={productType} onChange={(e) => setProductType(e.target.value)}>
                <option value="good">Good</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="field">
              <label>Unit of Measure</label>
              <input className="input" value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} />
            </div>
            <div className="field">
              <label>Barcode</label>
              <input className="input" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </div>
            <div className="field">
              <label>Unit Price (UGX)</label>
              <input className="input" type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="blank = leave unchanged" />
            </div>
            <div className="field">
              <label>Stock Quantity</label>
              <input className="input" type="number" min="0" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>Description</label>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
