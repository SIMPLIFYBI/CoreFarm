"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { useOrg } from "@/lib/OrgContext";
import { redirectTo } from "@/lib/siteUrl";
import toast from "react-hot-toast";

export default function TeamPage() {
  const supabase = supabaseBrowser();
  const [user, setUser] = useState(null);
  const { orgId: selectedOrgId, setOrgId: setSelectedOrgId, memberships, refreshMemberships } = useOrg();
  const [members, setMembers] = useState([]); // [{user_id, email, name, role, created_at}]
  const [invites, setInvites] = useState([]); // [{id,email,role,status,created_at}]
  const [emailToInvite, setEmailToInvite] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [orgName, setOrgName] = useState("");
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [myInvites, setMyInvites] = useState([]); // invites addressed to current user email
  // Invites UX controls
  const [inviteStatusFilter, setInviteStatusFilter] = useState("pending"); // 'pending' | 'accepted' | 'revoked' | 'all'
  const [deleteMode, setDeleteMode] = useState(false);
  const pendingMyInvite = useMemo(() => (myInvites || []).find((i) => i.status === "pending") || null, [myInvites]);
  const [tab, setTab] = useState('members'); // 'members' | 'invites' | 'org'
  // Post-create organisation onboarding + iterative single invites
  const [showPostCreateModal, setShowPostCreateModal] = useState(false);
  const [modalInviteEmail, setModalInviteEmail] = useState("");
  const [modalInviteRole, setModalInviteRole] = useState("member");
  const [modalInviting, setModalInviting] = useState(false);
  const [sessionInvites, setSessionInvites] = useState([]); // [{email,status,message}]

  const myRole = useMemo(() => {
    const m = memberships.find((m) => m.organization_id === selectedOrgId);
    return m?.role || null;
  }, [memberships, selectedOrgId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: invMine } = await supabase
        .from("organization_invites")
        .select("id, organization_id, email, role, status, created_at, organizations(name)")
        .eq("email", (user?.email || "").toLowerCase());
      setMyInvites(invMine || []);
    })();
  }, [user, supabase]);

  // Load members and invites based on org and filter
  useEffect(() => {
    if (!selectedOrgId) return;
    (async () => {
      const membersPromise = supabase.rpc("get_org_members_with_email", { org: selectedOrgId });
      let invitesQuery = supabase
        .from("organization_invites")
        .select("id, email, role, status, created_at")
        .eq("organization_id", selectedOrgId)
        .order("created_at", { ascending: false });
      if (inviteStatusFilter !== "all") {
        invitesQuery = invitesQuery.eq("status", inviteStatusFilter);
      }
      const [{ data: mems }, { data: invs }] = await Promise.all([membersPromise, invitesQuery]);
      setMembers(mems || []);
      setInvites(invs || []);
    })();
  }, [selectedOrgId, inviteStatusFilter, supabase]);

  // Create organisation
  const createOrg = async (e) => {
    e?.preventDefault?.();
    if (!orgName.trim()) return toast.error("Enter an organization name");
    if (!user) return toast.error("Not signed in");
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({ name: orgName.trim(), owner_id: user.id })
      .select("id")
      .single();
    if (error) {
      console.error("create org error", error);
      return toast.error("Could not create organization");
    }
    toast.success("Organization created");
    setOrgName("");
    setShowCreateOrgModal(false);
    await refreshMemberships();
    setSelectedOrgId(org.id);
    setShowPostCreateModal(true);
  };

  // Single invite
  const sendInvite = async (e) => {
    e?.preventDefault?.();
    if (!emailToInvite.trim()) return toast.error("Enter an email");
    if (!selectedOrgId) return toast.error("Select organisation first");
    const inviteEmail = emailToInvite.trim().toLowerCase();
    const { error } = await supabase.from("organization_invites").insert({
      organization_id: selectedOrgId,
      email: inviteEmail,
      role: inviteRole,
      invited_by: user.id,
    });
    if (error) {
      const msg = (error?.message || "").toLowerCase();
      if (msg.includes("uniq_pending_invite_org_email") || msg.includes("duplicate key")) {
        toast.error("An invite is already pending for that email");
      } else {
        toast.error("Could not send invite");
      }
      return;
    }
    const { error: mailErr } = await supabase.auth.signInWithOtp({
      email: inviteEmail,
      options: { emailRedirectTo: redirectTo('/register') },
    });
    if (mailErr) {
      toast.error("Invite created, email failed");
    } else {
      toast.success("Invite sent");
    }
    setEmailToInvite("");
    // Refresh list using current filter
    let q = supabase
      .from("organization_invites")
      .select("id, email, role, status, created_at")
      .eq("organization_id", selectedOrgId)
      .order("created_at", { ascending: false });
    if (inviteStatusFilter !== "all") q = q.eq("status", inviteStatusFilter);
    const { data: invs } = await q;
    setInvites(invs || []);
  };

  const revokeInvite = async (id) => {
    const { error } = await supabase
      .from("organization_invites")
      .update({ status: "revoked" })
      .eq("id", id);
    if (error) return toast.error("Could not revoke invite");
    // If filtering to pending, remove it from view; otherwise, update in place
    setInvites((arr) =>
      inviteStatusFilter === "pending"
        ? arr.filter((i) => i.id !== id)
        : arr.map((i) => (i.id === id ? { ...i, status: "revoked" } : i))
    );
  };

  const deleteInvite = async (id) => {
    const { error } = await supabase
      .from("organization_invites")
      .delete()
      .eq("id", id);
    if (error) return toast.error("Could not delete invite");
    setInvites((arr) => arr.filter((i) => i.id !== id));
  };

  const acceptInvite = async (inv) => {
    // Insert membership as self
    const { error: mErr } = await supabase
      .from("organization_members")
      .insert({ organization_id: inv.organization_id, user_id: user.id, role: inv.role });
    if (mErr) {
      const { data: existing } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", inv.organization_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existing) return toast.error("Could not join organization");
    }
    await supabase.from("organization_invites").update({ status: "accepted" }).eq("id", inv.id);
    toast.success("Joined organization");
    // refresh memberships via context helper
    await refreshMemberships();
    setMyInvites((arr) => arr.map((i) => (i.id === inv.id ? { ...i, status: "accepted" } : i)));
  };

  const changeRole = async (userId, role) => {
    const { error } = await supabase
      .from("organization_members")
      .update({ role })
      .eq("organization_id", selectedOrgId)
      .eq("user_id", userId);
    if (error) return toast.error("Could not update role");
    setMembers((arr) => arr.map((m) => (m.user_id === userId ? { ...m, role } : m)));
  };

  const removeMember = async (userId) => {
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", selectedOrgId)
      .eq("user_id", userId);
    if (error) return toast.error("Could not remove member");
    setMembers((arr) => arr.filter((m) => m.user_id !== userId));
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error(error.message || "Sign out failed");
    toast.success("Signed out");
    // Clear local state
    setUser(null);
    // Best-effort redirect via location (avoids needing next/navigation here)
    if (typeof window !== 'undefined') window.location.href = '/';
  };

  if (!user) return <div className="max-w-6xl mx-auto p-4 md:p-6">Sign in required.</div>;

  const currentOrg = memberships.find((m) => m.organization_id === selectedOrgId);

  return (
  <div className="max-w-6xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-4">Team Management</h1>
      {/* Tabs */}
      {showPostCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-10 px-4">
          <div className="card w-full max-w-lg relative p-6">
            <button
              type="button"
              className="absolute top-3 right-3 text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setShowPostCreateModal(false)}
            >✕</button>
            <div className="mb-5">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-transparent bg-clip-text">Organisation created</h2>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Invite teammates one at a time. You can also invite later from the Invites tab.
              </p>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (modalInviting) return;
                const email = modalInviteEmail.trim().toLowerCase();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
                if (!emailRegex.test(email)) { toast.error('Enter a valid email'); return; }
                if (!selectedOrgId) { toast.error('Organisation not ready'); return; }
                setModalInviting(true);
                let status = 'invited';
                let message = 'Invite created';
                const { error: insertErr } = await supabase.from('organization_invites').insert({
                  organization_id: selectedOrgId,
                  email,
                  role: modalInviteRole,
                  invited_by: user.id
                });
                if (insertErr) {
                  const msg = (insertErr.message || '').toLowerCase();
                  if (msg.includes('uniq_pending_invite_org_email') || msg.includes('duplicate key')) {
                    status = 'skipped';
                    message = 'Already pending';
                  } else {
                    status = 'error';
                    message = 'Insert failed';
                  }
                } else {
                  const { error: mailErr } = await supabase.auth.signInWithOtp({
                    email,
                    options: { emailRedirectTo: redirectTo('/register') }
                  });
                  if (mailErr) {
                    message = 'Invite created, email failed';
                  } else {
                    message = 'Email sent';
                  }
                }
                setSessionInvites(arr => [{ email, status, message, role: modalInviteRole }, ...arr]);
                if (status === 'invited') {
                  let q = supabase
                    .from('organization_invites')
                    .select('id, email, role, status, created_at')
                    .eq('organization_id', selectedOrgId)
                    .order('created_at',{ascending:false});
                  if (inviteStatusFilter !== 'all') q = q.eq('status', inviteStatusFilter);
                  const { data: invs } = await q;
                  setInvites(invs || []);
                }
                setModalInviteEmail('');
                setModalInviting(false);
              }}
              className="space-y-4"
            >
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-gray-600">Add member</label>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="email"
                    className="input w-64"
                    placeholder="email@example.com"
                    value={modalInviteEmail}
                    onChange={(e)=>setModalInviteEmail(e.target.value)}
                    autoFocus
                  />
                  <select className="select-gradient-sm" value={modalInviteRole} onChange={(e)=>setModalInviteRole(e.target.value)}>
                    <option value="member">General user</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button type="submit" className="btn btn-primary text-xs" disabled={modalInviting}>{modalInviting ? 'Adding...' : 'Add'}</button>
                </div>
                <p className="text-[11px] text-gray-500">Each invite sends a sign-in link. Duplicate pending invites are skipped.</p>
              </div>
            </form>
            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-medium mb-2">Session invites</h3>
              {sessionInvites.length === 0 ? (
                <p className="text-xs text-gray-500">No invites yet.</p>
              ) : (
                <ul className="space-y-1 max-h-48 overflow-y-auto text-xs">
                  {sessionInvites.map(si => (
                    <li key={si.email} className="flex items-center justify-between gap-4">
                      <span className="truncate">{si.email} — {si.role}</span>
                      <span className={`font-medium ${si.status==='invited' ? 'text-green-600' : si.status==='skipped' ? 'text-amber-600' : 'text-red-600'}`}>{si.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button type="button" className="btn text-xs" onClick={()=>setShowPostCreateModal(false)}>Finish</button>
            </div>
          </div>
        </div>
      )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {myRole === 'admin' ? (
            <div className="card p-4">
              <h2 className="font-medium mb-2">Your invitations</h2>
              {myInvites.length === 0 ? (
                <p className="text-sm text-gray-500">No invitations.</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {myInvites.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between">
                      <span>{inv.organizations?.name || inv.organization_id} — {inv.role} — {inv.status}</span>
                      {inv.status === 'pending' && <button className="btn text-xs" onClick={()=>acceptInvite(inv)}>Accept</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            pendingMyInvite && (
              <div className="card p-4">
                <h2 className="font-medium mb-2">Your invitation</h2>
                <ul className="text-sm space-y-2">
                  <li key={pendingMyInvite.id} className="flex items-center justify-between">
                    <span>{pendingMyInvite.organizations?.name || pendingMyInvite.organization_id} — {pendingMyInvite.role} — pending</span>
                    <button className="btn text-xs" onClick={()=>acceptInvite(pendingMyInvite)}>Accept</button>
                  </li>
                </ul>
              </div>
            )
          )}
        </div>
      )}

      {tab === 'members' && memberships.length > 0 && (
        <div className="space-y-6">
          {myRole !== 'admin' ? (
            <div className="card p-4">
              <p className="text-sm">Admins only. Ask an admin to adjust membership.</p>
              <h3 className="font-medium mt-3 mb-2">Members</h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.user_id}>
                        <td>{m.user_id === user.id ? `${m.name || m.email} (you)` : (m.name || m.email)}</td>
                        <td>{m.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card p-4">
              <h3 className="font-medium mb-2">Members</h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th className="w-40">Role</th>
                      <th className="w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.user_id}>
                        <td>{m.user_id === user.id ? `${m.name || m.email} (you)` : (m.name || m.email)}</td>
                        <td>
                          <select className="select-gradient-sm" value={m.role} onChange={(e)=>changeRole(m.user_id, e.target.value)}>
                            <option value="member">General user</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td>
                          <button className="btn text-xs" onClick={()=>removeMember(m.user_id)} disabled={members.filter(x=>x.role==='admin').length===1 && m.role==='admin'}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {showCreateOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card p-6 w-full max-w-md relative">
            <button
              type="button"
              className="absolute top-2 right-2 text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setShowCreateOrgModal(false)}
            >
              ✕
            </button>
            <h2 className="text-lg font-medium mb-2">Create new organization</h2>
            <p className="text-xs text-amber-600 mb-4">
              Only users invited to your organization will be able to view your data.
            </p>
            <form onSubmit={createOrg} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Organization name</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="e.g., Goldfields"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" className="btn text-xs" onClick={() => setShowCreateOrgModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Create
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                You will become the admin and can switch between organizations from the selector.
              </p>
            </form>
          </div>
        </div>
      )}
      {showPostCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-10 px-4">
          <div className="card w-full max-w-2xl relative p-6">
            <button
              type="button"
              className="absolute top-3 right-3 text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setShowPostCreateModal(false)}
            >✕</button>
            <div className="mb-5">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-transparent bg-clip-text">Organisation created</h2>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Please note, only invited members will be able to join and see the data within your new organisation. Invite your teammates now (you can always add more later).
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1 uppercase tracking-wide text-gray-600">Emails to invite</label>
                <textarea
                  className="input w-full min-h-[120px] font-mono text-xs resize-y"
                  placeholder={"Paste or type emails separated by commas, spaces or new lines\nexample1@company.com, example2@company.com"}
                  value={bulkInviteInput}
                  onChange={(e)=>setBulkInviteInput(e.target.value)}
                />
                <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
                  <span>We'll ignore duplicates & invalid entries.</span>
                  <label className="flex items-center gap-2">
                    <span className="text-gray-600">Role</span>
                    <select className="select-gradient-sm" value={bulkInviteRole} onChange={(e)=>setBulkInviteRole(e.target.value)}>
                      <option value="member">General user</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                </div>
              </div>
              <BulkInvitePreview input={bulkInviteInput} results={bulkInviteResults} inviting={bulkInviting} />
              <div className="flex flex-wrap gap-3 justify-end pt-2 border-t">
                <button type="button" className="btn text-xs" onClick={()=>setShowPostCreateModal(false)}>Skip for now</button>
                <button
                  type="button"
                  className="btn btn-primary text-xs"
                  disabled={bulkInviting}
                  onClick={async () => {
                    const emails = Array.from(new Set((bulkInviteInput || '')
                      .split(/\s|,|;|\n/)
                      .map(e=>e.trim().toLowerCase())
                      .filter(e=>e.length>3)));
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
                    const valid = emails.filter(e=>emailRegex.test(e));
                    if (valid.length === 0) { toast.error('No valid emails'); return; }
                    if (!selectedOrgId) { toast.error('Organisation not ready yet'); return; }
                    setBulkInviting(true);
                    setBulkInviteResults([]);
                    const payload = valid.slice(0,50).map(email => ({
                      organization_id: selectedOrgId,
                      email,
                      role: bulkInviteRole,
                      invited_by: user.id
                    }));
                    const results = [];
                    if (payload.length) {
                      const { error: insertErr } = await supabase.from('organization_invites').insert(payload);
                      if (insertErr) {
                        for (const rec of payload) {
                          const { error: singleErr } = await supabase.from('organization_invites').insert(rec);
                          if (singleErr) {
                            const msg = (singleErr.message||'').toLowerCase();
                            if (msg.includes('uniq_pending_invite_org_email') || msg.includes('duplicate key')) {
                              results.push({ email: rec.email, status: 'skipped', message: 'Already pending' });
                            } else {
                              results.push({ email: rec.email, status: 'error', message: 'Insert failed' });
                            }
                          } else {
                            results.push({ email: rec.email, status: 'invited', message: 'Created' });
                          }
                        }
                      } else {
                        for (const rec of payload) results.push({ email: rec.email, status: 'invited', message: 'Created' });
                      }
                    }
                    for (const r of results.filter(r=>r.status==='invited')) {
                      const { error: mailErr } = await supabase.auth.signInWithOtp({
                        email: r.email,
                        options: { emailRedirectTo: redirectTo('/register') }
                      });
                      if (mailErr) {
                        r.message = 'Invite created, email failed';
                      } else {
                        r.message = 'Email sent';
                      }
                    }
                    setBulkInviteResults(results);
                    setBulkInviting(false);
                    let q = supabase
                      .from('organization_invites')
                      .select('id, email, role, status, created_at')
                      .eq('organization_id', selectedOrgId)
                      .order('created_at',{ascending:false});
                    if (inviteStatusFilter !== 'all') q = q.eq('status', inviteStatusFilter);
                    const { data: invs } = await q;
                    setInvites(invs || []);
                    toast.success(`Processed ${results.length} emails`);
                  }}
                >{bulkInviting ? 'Inviting...' : 'Send invites'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {user && (
        <div className="mt-10 pt-6 border-t">
          <button onClick={signOut} className="btn btn-primary text-xs" aria-label="Sign out" title="Sign out">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function BulkInvitePreview({ input, results, inviting }) {
  const emails = Array.from(new Set((input || '')
    .split(/\s|,|;|\n/)
    .map(e=>e.trim().toLowerCase())
    .filter(e=>e.length>3)));
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const valid = emails.filter(e=>emailRegex.test(e));
  const invalid = emails.filter(e=>!emailRegex.test(e));
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs space-y-2">
      <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
        {valid.slice(0,100).map(e => (
          <span key={e} className="px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white">{e}</span>
        ))}
        {invalid.slice(0,50).map(e => (
          <span key={e} className="px-2 py-0.5 rounded-full bg-red-200 text-red-800 line-through">{e}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-gray-600">
        <span><strong>{valid.length}</strong> valid</span>
        {invalid.length>0 && <span><strong>{invalid.length}</strong> invalid</span>}
        {emails.length>150 && <span>Showing first 150 entries</span>}
        {inviting && <span className="text-indigo-600 animate-pulse">Sending invites...</span>}
      </div>
      {results && results.length>0 && (
        <div className="max-h-40 overflow-y-auto border-t pt-2">
          <ul className="space-y-1">
            {results.map(r => (
              <li key={r.email} className="flex items-center justify-between gap-4">
                <span className="truncate">{r.email}</span>
                <span className={`text-[11px] font-medium ${r.status==='invited' ? 'text-green-600' : r.status==='skipped' ? 'text-amber-600' : 'text-red-600'}`}>{r.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
