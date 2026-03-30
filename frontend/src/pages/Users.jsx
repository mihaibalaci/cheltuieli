import { useState, useEffect, useRef } from 'react';
import { UserPlus, Trash2, KeyRound, Save, ChevronDown, ChevronUp, Download, Upload, AlertTriangle, Edit2, X, Plus } from 'lucide-react';
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
  const [accounts, setAccounts] = useState([]);
  const [editAccount, setEditAccount] = useState(null); // { id, name, iban, color }
  const [newAccount, setNewAccount] = useState(null); // { name, iban, color }
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

  // Backup/restore state
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const restoreInputRef = useRef(null);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }

  function loadUsers() {
    api.getUsers().then(setUsers).catch(() => {});
  }

  function loadAccounts() {
    api.getAccounts().then(setAccounts).catch(() => {});
  }

  useEffect(() => {
    loadUsers();
    loadAccounts();
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

  async function handleSaveAccount() {
    const a = editAccount;
    if (!a.name?.trim() || !a.iban?.trim()) return showToast('Name and IBAN required', true);
    try {
      await api.updateAccount(a.id, { name: a.name.trim(), iban: a.iban.trim(), color: a.color });
      setEditAccount(null);
      loadAccounts();
      showToast('Account updated');
    } catch (err) { showToast(err.message, true); }
  }

  async function handleCreateAccount() {
    const a = newAccount;
    if (!a.name?.trim() || !a.iban?.trim()) return showToast('Name and IBAN required', true);
    try {
      await api.createAccount({ name: a.name.trim(), iban: a.iban.trim(), color: a.color || '#6366f1' });
      setNewAccount(null);
      loadAccounts();
      showToast('Account created');
    } catch (err) { showToast(err.message, true); }
  }

  async function handleDeleteAccount(acc) {
    if (!confirm(`Delete account "${acc.name}"? Transactions will lose their account link.`)) return;
    try {
      await api.deleteAccount(acc.id);
      loadAccounts();
      showToast('Account deleted');
    } catch (err) { showToast(err.message, true); }
  }

  async function handleBackup() {
    setBackingUp(true);
    try {
      await api.backup();
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setBackingUp(false);
    }
  }

  async function handleRestore() {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      await api.restore(restoreFile);
      showToast('Database restored. The server is restarting, please wait a moment then refresh.');
      setRestoreFile(null);
      setRestoreConfirm(false);
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setRestoring(false);
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

      {/* Bank Accounts */}
      <Section title="Bank Accounts">
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Accounts are matched automatically when importing files by IBAN. Spaces in IBANs are ignored.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--bg)', border: '1px solid var(--border)',
            }}>
              {editAccount?.id === acc.id ? (
                <>
                  <input style={{ ...inputStyle, flex: 1 }} value={editAccount.name}
                    onChange={e => setEditAccount(a => ({ ...a, name: e.target.value }))}
                    placeholder="Account name" autoFocus />
                  <input style={{ ...inputStyle, flex: 2, fontFamily: 'DM Mono', fontSize: 13 }} value={editAccount.iban}
                    onChange={e => setEditAccount(a => ({ ...a, iban: e.target.value }))}
                    placeholder="IBAN" />
                  <input type="color" value={editAccount.color || '#6366f1'}
                    onChange={e => setEditAccount(a => ({ ...a, color: e.target.value }))}
                    style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 2, background: 'none' }} />
                  <button onClick={handleSaveAccount} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12 }}>Save</button>
                  <button onClick={() => setEditAccount(null)} style={{ ...btnGhost, padding: '6px 10px' }}><X size={13} /></button>
                </>
              ) : (
                <>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: acc.color || '#6366f1', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{acc.name}</div>
                    <div style={{ fontSize: 11, fontFamily: 'DM Mono', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{acc.iban}</div>
                  </div>
                  <button onClick={() => setEditAccount({ ...acc })} style={btnGhost}>
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => handleDeleteAccount(acc)} style={btnDanger}>
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        {newAccount ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <input style={{ ...inputStyle, flex: 1 }} value={newAccount.name}
              onChange={e => setNewAccount(a => ({ ...a, name: e.target.value }))}
              placeholder="Account name" autoFocus />
            <input style={{ ...inputStyle, flex: 2, fontFamily: 'DM Mono', fontSize: 13 }} value={newAccount.iban}
              onChange={e => setNewAccount(a => ({ ...a, iban: e.target.value }))}
              placeholder="IBAN (e.g. NL56 ABNA 0865 4740 01)" />
            <input type="color" value={newAccount.color || '#6366f1'}
              onChange={e => setNewAccount(a => ({ ...a, color: e.target.value }))}
              style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 2, background: 'none' }} />
            <button onClick={handleCreateAccount} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12 }}>Add</button>
            <button onClick={() => setNewAccount(null)} style={{ ...btnGhost, padding: '6px 10px' }}><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => setNewAccount({ name: '', iban: '', color: '#6366f1' })} style={{ ...btnGhost, display: 'inline-flex' }}>
            <Plus size={13} /> Add account
          </button>
        )}
      </Section>

      {/* Data Management */}
      <Section title="Data Management">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Backup</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Download a full backup of your database including all transactions, categories, rules and users.
          </p>
          <button
            onClick={handleBackup}
            disabled={backingUp}
            style={{ ...btnGhost, display: 'inline-flex' }}
          >
            <Download size={13} />
            {backingUp ? 'Preparing…' : 'Download backup'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Restore</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Upload a previously downloaded backup file to restore your data. The server will restart automatically.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".db"
              onChange={e => { setRestoreFile(e.target.files[0] || null); setRestoreConfirm(false); }}
              style={{ fontSize: 12, color: 'var(--text-muted)' }}
            />
            {restoreFile && !restoreConfirm && (
              <button
                onClick={() => setRestoreConfirm(true)}
                style={{ ...btnDanger, padding: '7px 14px' }}
              >
                <Upload size={13} />
                Restore "{restoreFile.name}"
              </button>
            )}
          </div>

          {restoreConfirm && (
            <div style={{
              marginTop: 14, background: '#ef444411', border: '1px solid #ef444433',
              borderRadius: 8, padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
                <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: 'var(--text)' }}>
                  This will <strong>replace all data</strong> with the backup and restart the server. Are you sure?
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleRestore} disabled={restoring}
                  style={{ ...btnDanger, padding: '7px 14px', fontWeight: 600 }}>
                  {restoring ? 'Restoring…' : 'Yes, restore now'}
                </button>
                <button onClick={() => setRestoreConfirm(false)} style={btnGhost}>
                  Cancel
                </button>
              </div>
            </div>
          )}
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
