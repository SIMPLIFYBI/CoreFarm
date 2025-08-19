"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { redirectTo } from "@/lib/siteUrl";
import toast from "react-hot-toast";

export default function TeamPage() {
  const supabase = supabaseBrowser();
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]); // [{organization_id, role, organizations: {name}}]
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [members, setMembers] = useState([]); // [{user_id, email, name, role, created_at}]
  const [invites, setInvites] = useState([]); // [{id,email,role,status,created_at}]
  const [emailToInvite, setEmailToInvite] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [orgName, setOrgName] = useState("");
  const [myInvites, setMyInvites] = useState([]); // invites addressed to current user email
  // Invites UX controls
  const [inviteStatusFilter, setInviteStatusFilter] = useState("pending"); // 'pending' | 'accepted' | 'revoked' | 'all'
  const [deleteMode, setDeleteMode] = useState(false);

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
      // Load memberships with org names
      const { data: ms, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(name)")
        .eq("user_id", user.id);
      if (error) {
        toast.error("Could not load memberships");
      }
      setMemberships(ms || []);
      if ((ms || []).length > 0) setSelectedOrgId(ms[0].organization_id);

      // Load invites to me
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

  const createOrg = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) return toast.error("Enter an organization name");
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({ name: orgName.trim(), owner_id: user.id })
      .select("id")
      .single();
    if (error) {
      console.error("create org error", error);
      return toast.error("Could not create organization");
    }
    // Membership is auto-created via trigger
    toast.success("Organization created");
    setOrgName("");
    // refresh memberships
    const { data: ms } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", user.id);
    setMemberships(ms || []);
    setSelectedOrgId(org.id);
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    if (!emailToInvite.trim()) return toast.error("Enter an email");
    const inviteEmail = emailToInvite.trim().toLowerCase();
    const { error } = await supabase.from("organization_invites").insert({
      organization_id: selectedOrgId,
      email: inviteEmail,
      role: inviteRole,
      invited_by: user.id,
    });
    if (error) {
      // If unique pending constraint hits, inform the admin
      const msg = (error?.message || "").toLowerCase();
      if (msg.includes("uniq_pending_invite_org_email") || msg.includes("duplicate key")) {
        toast.error("An invite is already pending for that email");
      } else {
        toast.error("Could not send invite");
      }
      return;
    }
    // Also email a magic-link so the invitee can register/sign in
  const { error: mailErr } = await supabase.auth.signInWithOtp({
      email: inviteEmail,
      options: {
    emailRedirectTo: redirectTo('/register'),
      },
    });
    if (mailErr) {
      toast.error("Invite created, but email failed to send");
    } else {
      toast.success("Invite sent and email delivered");
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
    // refresh
    const { data: ms } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .eq("user_id", user.id);
    setMemberships(ms || []);
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

  if (!user) return <div className="max-w-4xl mx-auto p-6">Sign in required.</div>;

  const currentOrg = memberships.find((m) => m.organization_id === selectedOrgId);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Team Management</h1>

      {memberships.length === 0 ? (
        <div className="space-y-6">
          <form onSubmit={createOrg} className="card p-4">
            <h2 className="font-medium mb-2">Create your organization</h2>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                className="input w-80"
                placeholder="Organization name (e.g., Goldfields)"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Create</button>
            </div>
            <p className="text-xs text-gray-500 mt-2">You'll become the admin and can invite your team.</p>
          </form>

          <div className="card p-4">
            <h2 className="font-medium mb-2">Your invitations</h2>
            {myInvites.length === 0 ? (
              <p className="text-sm text-gray-500">No invitations.</p>
            ) : (
              <ul className="text-sm space-y-2">
                {myInvites.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between">
                    <span>
                      {inv.organizations?.name || inv.organization_id} — {inv.role} — {inv.status}
                    </span>
                    {inv.status === "pending" && (
                      <button className="btn text-xs" onClick={() => acceptInvite(inv)}>Accept</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Organization</label>
            <select
              className="select input-sm text-sm w-auto"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.organization_id} value={m.organization_id}>
                  {m.organizations?.name || m.organization_id}
                </option>
              ))}
            </select>
            <span className="ml-2 text-xs text-gray-600">Your role: {myRole}</span>
          </div>

          {myRole !== "admin" ? (
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
                  {members.map((m) => (
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
            <>
              <form onSubmit={sendInvite} className="card p-4">
                <h2 className="font-medium mb-2">Invite a team member</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="email"
                    className="input w-72"
                    placeholder="email@example.com"
                    value={emailToInvite}
                    onChange={(e) => setEmailToInvite(e.target.value)}
                  />
                  <select className="select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="member">General user</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button type="submit" className="btn btn-primary">Send invite</button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Invitees sign in with their email, then accept the invite here.</p>
              </form>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Invites</h3>
                  <div className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-1">
                      <span className="text-gray-600">Filter</span>
                      <select
                        className="select input-sm text-sm w-auto"
                        value={inviteStatusFilter}
                        onChange={(e) => setInviteStatusFilter(e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="revoked">Revoked</option>
                        <option value="all">All</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={deleteMode}
                        onChange={(e) => setDeleteMode(e.target.checked)}
                      />
                      <span className="text-gray-700">Delete mode</span>
                    </label>
                  </div>
                </div>
                {invites.length === 0 ? (
                  <p className="text-sm text-gray-500">No invites{inviteStatusFilter !== 'all' ? ` (${inviteStatusFilter})` : ''}.</p>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th className="w-28">Actions</th>
                      </tr>
                      </thead>
                      <tbody>
                      {invites.map((i) => (
                        <tr key={i.id}>
                          <td>{i.email}</td>
                          <td>{i.role}</td>
                          <td>{i.status}</td>
                          <td className="space-x-2">
                            {deleteMode ? (
                              <button className="btn text-xs" onClick={() => deleteInvite(i.id)}>Delete</button>
                            ) : (
                              i.status === "pending" && (
                                <button className="btn text-xs" onClick={() => revokeInvite(i.id)}>Revoke</button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

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
                    {members.map((m) => (
                      <tr key={m.user_id}>
                        <td>{m.user_id === user.id ? `${m.name || m.email} (you)` : (m.name || m.email)}</td>
                        <td>
                          <select
                            className="select"
                            value={m.role}
                            onChange={(e) => changeRole(m.user_id, e.target.value)}
                          >
                            <option value="member">General user</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td>
                          <button
                            className="btn text-xs"
                            onClick={() => removeMember(m.user_id)}
                            disabled={members.filter((x) => x.role === "admin").length === 1 && m.role === "admin"}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          <div className="card p-4">
            <h2 className="font-medium mb-2">Your invitations</h2>
            {myInvites.length === 0 ? (
              <p className="text-sm text-gray-500">No invitations.</p>
            ) : (
              <ul className="text-sm space-y-2">
                {myInvites.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between">
                    <span>
                      {inv.organizations?.name || inv.organization_id} — {inv.role} — {inv.status}
                    </span>
                    {inv.status === "pending" && (
                      <button className="btn text-xs" onClick={() => acceptInvite(inv)}>Accept</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
