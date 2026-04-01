import { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, ChevronRight } from 'lucide-react';
import { api } from '../utils/api';
import { Modal, Toast, EmptyState } from '../components/UI';

const COLORS = ['#22c55e','#f97316','#3b82f6','#8b5cf6','#ef4444','#ec4899','#f59e0b','#06b6d4','#84cc16','#14b8a6','#a855f7','#10b981','#22d3ee','#6b7280','#c9a96e','#f43f5e'];
const ICONS = ['📦','🛒','🍽️','🚌','💡','🏠','🏥','🎬','🛍️','📱','✈️','📚','💰','💵','☕','🍕','🏋️','💊','🚗','🎮','🐾','👔','🎁','🏦',
  '🧾','💳','🔧','🪥','👶','🎓','🏖️','🍺','🎵','📰','🧹','🏢','⛽','🚿','🧴','💇','🩺','🦷','👓','🧸','🎂','🌿','🐶','🐱','🏡','🔑',
  '📡','🖥️','🎧','📸','🧳','🎭','🎨','⚽','🏊','🚲','🛵','🚕','🧊','🍿','🥐','🥗','🍣','🧁','🍷','🎄','💎','👗','👟','🧥','💄','🪴'];

function CategoryForm({ initial, categories, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [color, setColor] = useState(initial?.color || '#6366f1');
  const [icon, setIcon] = useState(initial?.icon || '📦');
  const [parentId, setParentId] = useState(initial?.parent_id ? String(initial.parent_id) : '');

  // Only top-level categories can be parents (avoid nesting beyond 1 level)
  const possibleParents = categories.filter(c => !c.parent_id && c.id !== initial?.id);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), color, icon, parent_id: parentId ? parseInt(parentId) : null });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Car Insurance" autoFocus onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Parent category (optional)</label>
        <select className="input" value={parentId} onChange={e => setParentId(e.target.value)}>
          <option value="">None — top-level category</option>
          {possibleParents.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Icon</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ICONS.map(ic => (
            <button key={ic} onClick={() => setIcon(ic)}
              style={{ width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: 'pointer', background: icon === ic ? 'var(--accent)22' : 'var(--surface2)', border: icon === ic ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
              {ic}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Color</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '3px solid white' : '2px solid transparent', boxShadow: color === c ? `0 0 0 2px ${c}` : 'none' }} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleSubmit} style={{ flex: 1 }}>
          <Save size={14} /> {initial ? 'Save Changes' : 'Create Category'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}><X size={14} /></button>
      </div>
    </div>
  );
}

export default function Categories({ categories, onRefresh }) {
  const [showCreate, setShowCreate] = useState(false);
  const [createParentId, setCreateParentId] = useState(null); // pre-filled parent for quick sub-create
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async (data) => {
    try {
      await api.createCategory(data);
      setShowCreate(false);
      setCreateParentId(null);
      onRefresh();
      showToast('Category created');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleEdit = async (id, data) => {
    try {
      await api.updateCategory(id, data);
      setEditId(null);
      onRefresh();
      showToast('Category updated');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? Transactions will be moved to "Other".`)) return;
    await api.deleteCategory(id);
    onRefresh();
    showToast('Category deleted');
  };

  // Group categories into parents + their children
  const parents = categories.filter(c => !c.parent_id);
  const childrenMap = {};
  categories.filter(c => c.parent_id).forEach(c => {
    if (!childrenMap[c.parent_id]) childrenMap[c.parent_id] = [];
    childrenMap[c.parent_id].push(c);
  });

  const openCreateWithParent = (parentId) => {
    setCreateParentId(parentId);
    setShowCreate(true);
  };

  const initialForCreate = createParentId
    ? { parent_id: createParentId, color: categories.find(c => c.id === createParentId)?.color || '#6366f1', icon: '📦' }
    : undefined;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Categories
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{categories.length} categories configured</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setCreateParentId(null); setShowCreate(true); }}>
          <Plus size={15} /> New Category
        </button>
      </div>

      {showCreate && (
        <Modal title={createParentId ? `Add Subcategory` : 'Create Category'} onClose={() => { setShowCreate(false); setCreateParentId(null); }}>
          <CategoryForm
            initial={initialForCreate}
            categories={categories}
            onSave={handleCreate}
            onCancel={() => { setShowCreate(false); setCreateParentId(null); }}
          />
        </Modal>
      )}

      {editId && (
        <Modal title="Edit Category" onClose={() => setEditId(null)}>
          <CategoryForm
            initial={categories.find(c => c.id === editId)}
            categories={categories}
            onSave={(data) => handleEdit(editId, data)}
            onCancel={() => setEditId(null)}
          />
        </Modal>
      )}

      {categories.length === 0 ? (
        <EmptyState icon="🏷️" title="No categories yet" subtitle="Create your first category" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {parents.map(cat => {
            const subs = childrenMap[cat.id] || [];
            return (
              <div key={cat.id} className="card animate-fade-up" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Parent row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: cat.color, borderRadius: '12px 0 0 0' }} />
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, background: cat.color + '22',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
                  }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{cat.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {cat.transaction_count || 0} transactions
                      {cat.total_spent > 0 && <span style={{ color: 'var(--red)', marginLeft: 6 }}>· €{Number(cat.total_spent).toFixed(0)} spent</span>}
                      {subs.length > 0 && <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>· {subs.length} subcategories</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => openCreateWithParent(cat.id)}>
                      <Plus size={12} /> Sub
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setEditId(cat.id)}>
                      <Edit2 size={13} />
                    </button>
                    <button className="btn btn-danger" style={{ padding: '5px 8px' }} onClick={() => handleDelete(cat.id, cat.name)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Subcategories */}
                {subs.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                    {subs.map((sub, i) => (
                      <div key={sub.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 18px 10px 36px',
                        borderBottom: i < subs.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <ChevronRight size={12} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                        <div style={{
                          width: 28, height: 28, borderRadius: 7, background: sub.color + '22',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                        }}>
                          {sub.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{sub.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {sub.transaction_count || 0} transactions
                            {sub.total_spent > 0 && <span style={{ color: 'var(--red)', marginLeft: 6 }}>· €{Number(sub.total_spent).toFixed(0)} spent</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost" style={{ padding: '4px 7px' }} onClick={() => setEditId(sub.id)}>
                            <Edit2 size={12} />
                          </button>
                          <button className="btn btn-danger" style={{ padding: '4px 7px' }} onClick={() => handleDelete(sub.id, sub.name)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
