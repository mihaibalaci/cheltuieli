import { useState, useEffect } from 'react';
import { UserPlus, Trash2, KeyRound, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../utils/api';

function Section({ title, children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, marginBottom: 24, overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 6,
  background: 'var(--bg)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
  fontFamily: 'inherit', outline: 'none',
};

const btnPrimary = {
  padding: '8px 16px', borderRadius: 6, border: 'none',
  background: 'var(--accent)', color: '#0f0f0f', fontSize: 13,
  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};

const btnDanger = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid #ef444433',
  background: 'transparent', color: '#ef4444', fontSize: 12,
  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
};

const btnGhost = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-muted)', fontSize: 12,
  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
};

export default function Users({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);

  // My Account state
  const [email, setEmail] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // Add user state
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  // Per-user reset password state
  const [resetingId, setResetingId] = useState(null);
  const [resetPw, setResetPw] = useState('');

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }

  function loadUsers() {
    api.getUsers().then(setUsers).catch(() => {});
  }

  useEffect(() => {
    loadUsers();
    // Pre-fill email from current user
    api.me().then(u => setEmail(u.email || '')).catch(() => {});
  }, []);

  async function handleSaveEmail(e) {
    e.preventDefault();
    setSavingAccount(true);
    try {
      await api.updateUser(currentUser.id, { email });
      showToast('Email updated');
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPw !== confirmPw) return showToast('New passwords do not match', true);
    setSavingPw(true);
    try {
      await api.changePassword(currentPw, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast('Password changed successfully');
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSavingPw(false);
    }
  }

  async function handleAddUser(e) {
    e.preventDefault();
    setAddingUser(true);
    try {
      await api.createUser(newUsername, newPassword, newEmail);
      setNewUsername(''); setNewEmail(''); setNewPassword('');
      setShowAdd(false);
      loadUsers();
      showToast(`User "${newUsername}" created`);
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setAddingUser(false);
    }
  }

  async function handleDeleteUser(user) {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    try {
      await api.deleteUser(user.id);
      loadUsers();
      showToast(`User "${user.username}" deleted`);
    } catch (err) {
      showToast(err.message, true);
    }
  }

  async function handleResetPassword(userId) {
    if (!resetPw || resetPw.length < 6) return showToast('Password must be at least 6 characters', true);
    try {
      await api.updateUser(userId, { password: resetPw });
      setResetingId(null);
      setResetPw('');
      showToast('Password updated');
    } catch (err) {
      showToast(err.message, true);
    }
  }

  async function handleUpdateEmail(userId, newEmail) {
    try {
      await api.updateUser(userId, { email: newEmail });
      loadUsers();
      showToast('Email updated');
    } catch (err) {
      showToast(err.message, true);
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 680 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000,
          background: toast.isError ? '#ef4444' : '#22c55e',
          color: '#fff', padding: '10px 18px', borderRadius: 8,
          fontSize: 13, fontWeight: 500,
        }}>
          {toast.msg}
        </div>
      )}

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Account & Users</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
        Manage your account settings and application users.
      </p>

      {/* My Account */}
      <Section title="My Account">
        <form onSubmit={handleSaveEmail} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
            Logged in as <strong style={{ color: 'var(--text)' }}>{currentUser.username}</strong>
          </div>
          <Field label="Email address">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={inputStyle}
            />
          </Field>
          <button type="submit" disabled={savingAccount} style={btnPrimary}>
            <Save size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            {savingAccount ? 'Saving…' : 'Save email'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Change password</div>
          <form onSubmit={handleChangePassword}>
            <Field label="Current password">
              <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required style={inputStyle} />
            </Field>
            <Field label="New password">
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={6} style={inputStyle} />
            </Field>
            <Field label="Confirm new password">
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required style={inputStyle} />
            </Field>
            <button type="submit" disabled={savingPw} style={btnPrimary}>
              {savingPw ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </Section>

      {/* All Users */}
      <Section title="Users">
        {/* User list */}
        <div style={{ marginBottom: 16 }}>
          {users.map(u => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === currentUser.id}
              isReseting={resetingId === u.id}
              resetPw={resetPw}
              onResetPwChange={setResetPw}
              onToggleReset={() => { setResetingId(resetingId === u.id ? null : u.id); setResetPw(''); }}
              onConfirmReset={() => handleResetPassword(u.id)}
              onDelete={() => handleDeleteUser(u)}
              onUpdateEmail={(email) => handleUpdateEmail(u.id, email)}
            />
          ))}
        </div>

        {/* Add user */}
        <button
          onClick={() => setShowAdd(v => !v)}
          style={{ ...btnGhost, marginBottom: showAdd ? 16 : 0 }}
        >
          <UserPlus size={13} />
          Add user
          {showAdd ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showAdd && (
          <form onSubmit={handleAddUser} style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 16,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="Username">
                <input
                  type="text" value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  required style={inputStyle}
                />
              </Field>
              <Field label="Email (optional)">
                <input
                  type="email" value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <Field label="Password">
              <input
                type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required minLength={6} style={inputStyle}
              />
            </Field>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="submit" disabled={addingUser} style={btnPrimary}>
                {addingUser ? 'Creating…' : 'Create user'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} style={btnGhost}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Section>
    </div>
  );
}

function UserRow({ user, isSelf, isReseting, resetPw, onResetPwChange, onToggleReset, onConfirmReset, onDelete, onUpdateEmail }) {
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailVal, setEmailVal] = useState(user.email || '');

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '10px 14px',
        gap: 12, background: 'var(--bg)',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--accent)22', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: 'var(--accent)',
        }}>
          {user.username[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
            {user.username}
            {isSelf && <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>you</span>}
          </div>
          {editingEmail ? (
            <form onSubmit={e => { e.preventDefault(); onUpdateEmail(emailVal); setEditingEmail(false); }}
              style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input
                type="email"
                value={emailVal}
                onChange={e => setEmailVal(e.target.value)}
                autoFocus
                style={{ ...inputStyle, padding: '4px 8px', fontSize: 12, width: 200 }}
              />
              <button type="submit" style={{ ...btnPrimary, padding: '4px 10px', fontSize: 12 }}>Save</button>
              <button type="button" onClick={() => setEditingEmail(false)}
                style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }}>Cancel</button>
            </form>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer' }}
              onClick={() => setEditingEmail(true)}>
              {user.email || <span style={{ fontStyle: 'italic' }}>No email — click to add</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onToggleReset} style={btnGhost} title="Reset password">
            <KeyRound size={12} />
            {isReseting ? 'Cancel' : 'Reset password'}
          </button>
          {!isSelf && (
            <button onClick={onDelete} style={btnDanger} title="Delete user">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {isReseting && (
        <div style={{
          padding: '10px 14px', borderTop: '1px solid var(--border)',
          background: 'var(--surface)', display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <input
            type="password"
            value={resetPw}
            onChange={e => onResetPwChange(e.target.value)}
            placeholder="New password (min 6 chars)"
            autoFocus
            style={{ ...inputStyle, width: 240 }}
          />
          <button onClick={onConfirmReset} style={btnPrimary}>Set password</button>
        </div>
      )}
    </div>
  );
}
