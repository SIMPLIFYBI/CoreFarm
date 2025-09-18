"use client";

import { useEffect, useState } from "react";
import { IconPlods } from "../components/icons";
import { supabaseBrowser } from "../../lib/supabaseClient";
import { useOrg } from "../../lib/OrgContext";

export default function Page() {
  const [vendors, setVendors] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [holes, setHoles] = useState([]);
  // Open page to Home by default
  const [activeTab, setActiveTab] = useState("home");
  const [orgs, setOrgs] = useState([]);
  const [vendorForm, setVendorForm] = useState({ name: "", contact: "", organization_id: "" });
  const [vendorLoading, setVendorLoading] = useState(false);
  // slide-up form state
  const [showNewPlod, setShowNewPlod] = useState(false);
  const [form, setForm] = useState({ 
    vendor_id: "", 
    shift_date: new Date().toISOString().split('T')[0],
    notes: "",
    entered_by: "" // New field to store user name
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const { orgId } = useOrg();
  const [currentUser, setCurrentUser] = useState(null);

  // New state for activity type management
  const [activityTypeForm, setActivityTypeForm] = useState({ 
    activityType: "", 
    group: "", 
    description: "", 
    organization_id: "" 
  });
  const [activityTypeLoading, setActivityTypeLoading] = useState(false);

  // History tab state
  const [plods, setPlods] = useState([]);
  const [plodsLoading, setPlodsLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
    to: new Date().toISOString().split('T')[0] // today
  });

  // New state for activities within a PLOD
  const [activities, setActivities] = useState([]);
  const [activityForm, setActivityForm] = useState({ 
    activity_type_id: "", 
    hole_id: "", 
    started_at: "", 
    finished_at: "", 
    notes: "" 
  });
  const [editingActivityIndex, setEditingActivityIndex] = useState(null);

  // Update: Vendor resources state
  const [vendorResources, setVendorResources] = useState([]);
  const [expandedVendor, setExpandedVendor] = useState(null);
  const [resourceForm, setResourceForm] = useState({ 
    vendor_id: "", 
    name: "", 
    resource_type: "", 
    status: "Active",
    notes: "" 
  });
  const [resourceLoading, setResourceLoading] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);

  useEffect(() => {
    // Get current user info
    const fetchCurrentUser = async () => {
      const sb = supabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      
      if (user) {
        // Get user profile info if available
        const { data, error } = await sb
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setCurrentUser(data);
          // Set the entered_by field with user's name or email
          setForm(prev => ({ 
            ...prev, 
            entered_by: data.full_name || data.email || user.email 
          }));
        } else {
          // Fallback to auth email if profile not found
          setCurrentUser({ email: user.email });
          setForm(prev => ({ ...prev, entered_by: user.email }));
        }
      }
    };

    fetchCurrentUser();
    
    const sb = supabaseBrowser();
    // load organizations first so we can default org selection
    sb.from("organizations").select("id,name").limit(50).then((oRes) => {
      if (oRes.error) setMessage({ type: "error", text: oRes.error.message });
      else {
        setOrgs(oRes.data || []);
        if ((oRes.data || []).length > 0) {
          setVendorForm((s) => ({ ...s, organization_id: s.organization_id || oRes.data[0].id }));
          // Set the default org for the activity type form too
          setActivityTypeForm((s) => ({ ...s, organization_id: s.organization_id || oRes.data[0].id }));
        }
      }
    });

    // load org-scoped data only when orgId is available
    const vQuery = sb.from("vendors").select("id,name").limit(100);
    const aQuery = sb.from("plod_activity_types").select("id,activity_type,\"group\",description").limit(100);
    const hQuery = sb.from("holes").select("id,hole_id").limit(200);
    if (orgId) {
      vQuery.eq('organization_id', orgId);
      aQuery.eq('organization_id', orgId);
      hQuery.eq('organization_id', orgId);
    }
    Promise.all([vQuery, aQuery, hQuery]).then(([vRes, aRes, hRes]) => {
      if (vRes?.error) setMessage({ type: "error", text: vRes.error.message });
      else setVendors(vRes?.data || []);
      if (aRes?.error) setMessage({ type: "error", text: aRes.error.message });
      else setActivityTypes(aRes?.data || []);
      if (hRes?.error) setMessage({ type: "error", text: hRes.error.message });
      else setHoles(hRes?.data || []);
    });

    // Load plods history if Home tab is active
    if (activeTab === 'home' && orgId) {
      loadPlods();
    }
  }, [orgId, activeTab, expandedVendor]);

  // Load plods history with date filtering
  const loadPlods = async () => {
    if (!orgId) return;
    
    setPlodsLoading(true);
    const sb = supabaseBrowser();
    
    try {
      const { data, error } = await sb.from("plods")
        .select(`
          id, 
          started_at, 
          finished_at, 
          notes,
          vendors:vendor_id(name),
          plod_activities(
            id, 
            activity_type_id,
            hole_id,
            started_at,
            finished_at,
            notes,
            activity_types:activity_type_id(label, activity_type),
            holes:hole_id(hole_id)
          )
        `)
        .eq('organization_id', orgId)
        .gte('started_at', dateRange.from ? `${dateRange.from}T00:00:00` : null)
        .lte('started_at', dateRange.to ? `${dateRange.to}T23:59:59` : null)
        .order('started_at', { ascending: false })
        .limit(100);
      
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setPlods(data || []);
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load plods history" });
      console.error(err);
    } finally {
      setPlodsLoading(false);
    }
  };

  const handleDateRangeChange = (field) => (e) => {
    setDateRange(prev => ({ ...prev, [field]: e.target.value }));
  };

  // Calculate the duration between two timestamps in hours and minutes
  const calculateDuration = (start, end) => {
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diffMs = endTime - startTime;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Format datetime for display
  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    return new Intl.DateTimeFormat('default', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const refreshVendors = async () => {
    const sb = supabaseBrowser();
    const { data, error } = await sb.from("vendors").select("id,name").limit(500);
    if (error) setMessage({ type: "error", text: error.message });
    else setVendors(data || []);
  };

  // New function to refresh activity types
  const refreshActivityTypes = async () => {
    const sb = supabaseBrowser();
    const query = sb.from("plod_activity_types").select("id,activity_type,\"group\",description").limit(100);
    if (orgId) {
      query.eq('organization_id', orgId);
    }
    const { data, error } = await query;
    if (error) setMessage({ type: "error", text: error.message });
    else setActivityTypes(data || []);
  };

  const handleChange = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  // Update addActivity function to ensure dates match the shift date
  const addActivity = () => {
    // Validation
    if (!activityForm.activity_type_id || !activityForm.started_at || !activityForm.finished_at) {
      setMessage({ type: "error", text: "Please fill in all required activity details." });
      return;
    }
    
    // Ensure the activity dates use the shift date
    const shiftDate = form.shift_date;
    
    // Parse times from the activity form
    const startTime = activityForm.started_at.includes('T') 
      ? activityForm.started_at.split('T')[1] 
      : activityForm.started_at;
      
    const endTime = activityForm.finished_at.includes('T') 
      ? activityForm.finished_at.split('T')[1] 
      : activityForm.finished_at;
    
    // Create proper ISO datetime strings
    const startDateTime = `${shiftDate}T${startTime}`;
    const endDateTime = `${shiftDate}T${endTime}`;
    
    // Create the new activity with the properly formatted dates
    const newActivity = { 
      ...activityForm,
      started_at: startDateTime,
      finished_at: endDateTime
    };
    
    // Check for overnight shifts (end time earlier than start time)
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    if (endHour < startHour) {
      // Add a day to the end time for overnight shifts
      const nextDay = new Date(shiftDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      newActivity.finished_at = `${nextDayStr}T${endTime}`;
    }
    
    if (editingActivityIndex !== null) {
      // Update existing
      setActivities(current => 
        current.map((item, idx) => idx === editingActivityIndex ? newActivity : item)
      );
      setEditingActivityIndex(null);
    } else {
      // Add new
      setActivities(current => [...current, newActivity]);
    }
    
    // Reset form
    setActivityForm({ 
      activity_type_id: "", 
      hole_id: "", 
      started_at: "", 
      finished_at: "", 
      notes: "" 
    });
  };

  // Function to edit an activity
  const editActivity = (index) => {
    setActivityForm(activities[index]);
    setEditingActivityIndex(index);
  };

  // Function to remove an activity
  const removeActivity = (index) => {
    setActivities(current => current.filter((_, idx) => idx !== index));
    if (editingActivityIndex === index) {
      setEditingActivityIndex(null);
      setActivityForm({ 
        activity_type_id: "", 
        hole_id: "", 
        started_at: "", 
        finished_at: "", 
        notes: "" 
      });
    }
  };

  // Update the main form submission
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    
    // Validate basic PLOD info
    if (!form.shift_date) {
      setMessage({ type: "error", text: "Please specify shift date." });
      setLoading(false);
      return;
    }
    
    // Validate activities - need at least one
    if (activities.length === 0) {
      setMessage({ type: "error", text: "Please add at least one activity to the shift." });
      setLoading(false);
      return;
    }
    
    if (!orgId) {
      setMessage({ type: 'error', text: 'Please select an organization.' });
      setLoading(false);
      return;
    }
    
    try {
      const sb = supabaseBrowser();
      
      // Get the earliest start time and latest end time from activities
      const startTimes = activities.map(a => new Date(a.started_at).getTime());
      const endTimes = activities.map(a => new Date(a.finished_at).getTime());
      
      const earliestStart = new Date(Math.min(...startTimes));
      const latestEnd = new Date(Math.max(...endTimes));
      
      // Create the parent PLOD with entered_by field
      const plodPayload = {
        organization_id: orgId,
        vendor_id: form.vendor_id || null,
        started_at: earliestStart.toISOString(),
        finished_at: latestEnd.toISOString(),
        shift_date: form.shift_date,
        notes: form.notes || null,
        entered_by: form.entered_by || null // Save the user who entered this plod
      };
      
      const { data: plodData, error: plodError } = await sb
        .from("plods")
        .insert(plodPayload)
        .select()
        .single();
      
      if (plodError) throw plodError;
      
      // 2. Then insert all activities with references to the parent PLOD
      const activitiesPayload = activities.map(activity => ({
        plod_id: plodData.id,
        activity_type_id: activity.activity_type_id,
        hole_id: activity.hole_id || null,
        started_at: activity.started_at,
        finished_at: activity.finished_at,
        notes: activity.notes || null
      }));
      
      const { data: activitiesData, error: activitiesError } = await sb
        .from("plod_activities")
        .insert(activitiesPayload);
      
      if (activitiesError) throw activitiesError;
      
      setMessage({ type: "success", text: "Shift with activities recorded." });
      
      // Reset forms
      setForm({ 
        vendor_id: "", 
        shift_date: new Date().toISOString().split('T')[0], // Reset to today 
        notes: "" 
      });
      setActivities([]);
      setActivityForm({ 
        activity_type_id: "", 
        hole_id: "", 
        started_at: "", 
        finished_at: "", 
        notes: "" 
      });
      
    } catch (error) {
      console.error("Error saving PLOD with activities:", error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVendorChange = (k) => (e) => setVendorForm((s) => ({ ...s, [k]: e.target.value }));

  // Add this function to properly load vendors with org filtering
  const loadVendors = async () => {
    if (!orgId) return;
    
    try {
      const sb = supabaseBrowser();
      // Explicitly filter by organization_id to prevent showing all vendors
      const { data, error } = await sb
        .from("vendors")
        .select("*")
        .eq("organization_id", orgId)  // Always filter by current org
        .order("name");
      
      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error("Error loading vendors:", error);
      setMessage({ type: "error", text: `Failed to load vendors: ${error.message}` });
    }
  };

  const submitVendor = async (e) => {
    e.preventDefault();
    setVendorLoading(true);
    setMessage(null);
    
    // Validation
    if (!vendorForm.name) {
      setMessage({ type: "error", text: "Please provide a vendor name." });
      setVendorLoading(false);
      return;
    }
    
    if (!orgId) {
      setMessage({ type: "error", text: "Organization ID is missing." });
      setVendorLoading(false);
      return;
    }
    
    try {
      const sb = supabaseBrowser();
      const payload = {
        name: vendorForm.name,
        contact: vendorForm.contact,
        organization_id: orgId  // Make sure this is always set
      };
      
      const { data, error } = await sb
        .from("vendors")
        .insert(payload)
        .select()
        .single();
      
      if (error) throw error;
      
      // IMPORTANT: Use the loadVendors function to reload with proper filtering
      // instead of directly appending to the state
      await loadVendors();
      
      setMessage({ type: "success", text: "Vendor added successfully." });
      setVendorForm({ name: "", contact: "" });
    } catch (error) {
      console.error("Error saving vendor:", error);
      setMessage({ type: "error", text: `Failed to add vendor: ${error.message}` });
    } finally {
      setVendorLoading(false);
    }
  };

  // New handlers for activity type form
  const handleActivityTypeChange = (k) => (e) => setActivityTypeForm((s) => ({ ...s, [k]: e.target.value }));

  const submitActivityType = async (e) => {
    e.preventDefault();
    setActivityTypeLoading(true);
    setMessage(null);
    
    // Validation - only check activityType now
    if (!activityTypeForm.activityType) {
      setMessage({ type: "error", text: "Please provide an activity type." });
      setActivityTypeLoading(false);
      return;
    }
    
    if (!orgId) {
      setMessage({ type: "error", text: "Please select an organization first." });
      setActivityTypeLoading(false);
      return;
    }
    
    const sb = supabaseBrowser();
    const payload = {
      organization_id: orgId,
      activity_type: activityTypeForm.activityType, 
      group: activityTypeForm.group || null,
      description: activityTypeForm.description || null
    };
    
    const { data, error } = await sb.from("plod_activity_types").insert(payload).select().single();
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Activity type added." });
      setActivityTypeForm((s) => ({ 
        ...s, 
        activityType: "",
        group: "", 
        description: "" 
      }));
      // Refresh the list
      await refreshActivityTypes();
    }
    setActivityTypeLoading(false);
  };

  // Update: Load resources for a vendor
  const loadVendorResources = async (vendorId) => {
    if (!vendorId) return;
    
    try {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("vendor_resources")
        .select("*")
        .eq("vendor_id", vendorId)
        .eq("organization_id", orgId)
        .order("name");
        
      if (error) throw error;
      setVendorResources(data || []);
    } catch (error) {
      console.error("Error loading vendor resources:", error);
      setMessage({ type: "error", text: `Failed to load resources: ${error.message}` });
    }
  };

  // Update: Toggle vendor expand/collapse
  const toggleVendorExpand = (vendorId) => {
    if (expandedVendor === vendorId) {
      setExpandedVendor(null);
    } else {
      setExpandedVendor(vendorId);
      loadVendorResources(vendorId);
    }
  };

  // Update: Resource form handlers
  const handleResourceChange = (k) => (e) => setResourceForm(prev => ({ ...prev, [k]: e.target.value }));

  // Function to open the modal for creating a new resource
  const openAddResourceModal = (vendorId) => {
    setResourceForm({
      vendor_id: vendorId,
      name: "",
      resource_type: "",
      status: "Active",
      notes: ""
    });
    setEditingResourceId(null);
    setResourceModalOpen(true);
  };

  // Function to open the modal for editing a resource
  const openEditResourceModal = (resource) => {
    setResourceForm({
      vendor_id: resource.vendor_id,
      name: resource.name,
      resource_type: resource.resource_type || "",
      status: resource.status,
      notes: resource.notes || ""
    });
    setEditingResourceId(resource.id);
    setResourceModalOpen(true);
  };

  const submitResource = async (e) => {
    e.preventDefault();
    setResourceLoading(true);
    setMessage(null);
    
    // Validation
    if (!resourceForm.name) {
      setMessage({ type: "error", text: "Resource name is required" });
      setResourceLoading(false);
      return;
    }
    
    try {
      const sb = supabaseBrowser();
      const payload = {
        ...resourceForm,
        organization_id: orgId
      };
      
      let result;
      if (editingResourceId) {
        // Update existing resource
        const { data, error } = await sb
          .from("vendor_resources")
          .update(payload)
          .eq("id", editingResourceId)
          .select()
          .single();
          
        if (error) throw error;
        result = data;
        setMessage({ type: "success", text: "Resource updated successfully" });
      } else {
        // Create new resource
        const { data, error } = await sb
          .from("vendor_resources")
          .insert(payload)
          .select()
          .single();
          
        if (error) throw error;
        result = data;
        setMessage({ type: "success", text: "Resource added successfully" });
      }
      
      // Refresh resources list and close modal
      await loadVendorResources(resourceForm.vendor_id);
      setResourceModalOpen(false);
      
      // Reset form
      setResourceForm({
        vendor_id: "",
        name: "",
        resource_type: "",
        status: "Active",
        notes: ""
      });
      setEditingResourceId(null);
    } catch (error) {
      console.error("Error saving vendor resource:", error);
      setMessage({ type: "error", text: `Failed to save resource: ${error.message}` });
    } finally {
      setResourceLoading(false);
    }
  };

  const editResource = (resource) => {
    setResourceForm({
      vendor_id: resource.vendor_id,
      name: resource.name,
      resource_type: resource.resource_type || "",
      status: resource.status,
      notes: resource.notes || ""
    });
    setEditingResourceId(resource.id);
  };

  const deleteResource = async (resourceId) => {
    if (!confirm("Are you sure you want to delete this resource?")) return;
    
    try {
      const sb = supabaseBrowser();
      const { error } = await sb
        .from("vendor_resources")
        .delete()
        .eq("id", resourceId);
        
      if (error) throw error;
      
      // Refresh resources list
      await loadVendorResources(expandedVendor);
      setMessage({ type: "success", text: "Resource deleted successfully" });
    } catch (error) {
      console.error("Error deleting vendor resource:", error);
      setMessage({ type: "error", text: `Failed to delete resource: ${error.message}` });
    }
  };

  // Add a reusable AddPlodForm component (move your existing Add Plod tab form JSX here)
  function AddPlodForm({ onClose } = {}) {
    return (
      <form onSubmit={submit} className="space-y-6">
        <div className="border-b pb-4 mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Shift Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Vendor (optional)</label>
              <select value={form.vendor_id} onChange={handleChange("vendor_id")} className="mt-1 block w-full rounded border p-2">
                <option value="">— select vendor —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Shift Date</label>
              <input 
                required 
                type="date" 
                value={form.shift_date} 
                onChange={handleChange("shift_date")} 
                className="mt-1 block w-full rounded border p-2" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Plod entered by</label>
              <input 
                type="text" 
                value={form.entered_by} 
                readOnly
                className="mt-1 block w-full rounded border bg-gray-50 p-2" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Shift Notes (optional)</label>
              <textarea 
                value={form.notes} 
                onChange={handleChange("notes")} 
                rows={2} 
                className="mt-1 block w-full rounded border p-2" 
                placeholder="Overall shift notes"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Shift Activities</h3>

          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Activity Type</label>
                <select 
                  value={activityForm.activity_type_id} 
                  onChange={(e) => setActivityForm(prev => ({ ...prev, activity_type_id: e.target.value }))
                  }
                  className="mt-1 block w-full rounded border p-2"
                >
                  <option value="">— select activity —</option>
                  {activityTypes.map((a) => (
                    <option key={a.id} value={a.id}>{a.activity_type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Hole (optional)</label>
                <select 
                  value={activityForm.hole_id} 
                  onChange={(e) => setActivityForm(prev => ({ ...prev, hole_id: e.target.value }))
                  }
                  className="mt-1 block w-full rounded border p-2"
                >
                  <option value="">— select hole —</option>
                  {holes.map((h) => (
                    <option key={h.id} value={h.id}>{h.hole_id}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Started At</label>
                <input 
                  type="time" 
                  value={activityForm.started_at ? new Date(activityForm.started_at).toTimeString().slice(0,5) : ""}
                  onChange={(e) => {
                    const timeStr = e.target.value;
                    const dateStr = form.shift_date;
                    const dateTimeStr = `${dateStr}T${timeStr}`;
                    setActivityForm(prev => ({ ...prev, started_at: dateTimeStr }));
                  }}
                  className="mt-1 block w-full rounded border p-2" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Finished At</label>
                <input 
                  type="time" 
                  value={activityForm.finished_at ? new Date(activityForm.finished_at).toTimeString().slice(0,5) : ""}
                  onChange={(e) => {
                    const timeStr = e.target.value;
                    const dateStr = form.shift_date;
                    const dateTimeStr = `${dateStr}T${timeStr}`;
                    setActivityForm(prev => ({ ...prev, finished_at: dateTimeStr }));
                  }}
                  className="mt-1 block w-full rounded border p-2" 
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea 
                value={activityForm.notes}
                onChange={(e) => setActivityForm(prev => ({ ...prev, notes: e.target.value }))
                }
                rows={2} 
                className="mt-1 block w-full rounded border p-2"
                placeholder="Activity specific notes" 
              />
            </div>
            
            <div className="flex justify-end">
              <button 
                type="button"
                onClick={addActivity}
                className="inline-flex items-center rounded bg-indigo-600 text-white px-4 py-2"
              >
                {editingActivityIndex !== null ? 'Update Activity' : 'Add Activity'}
              </button>
            </div>
          </div>

          {/* List of added activities */}
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                No activities added yet. Add at least one activity above.
              </div>
            ) : (
              activities.map((activity, idx) => {
                const actType = activityTypes.find(a => a.id === activity.activity_type_id);
                const hole = holes.find(h => h.id === activity.hole_id);

                return (
                  <div key={idx} className="border rounded-lg p-3 bg-gray-50 flex justify-between items-center">
                    <div>
                      <div className="font-medium">
                        {actType?.activity_type || 'Unknown Activity'}
                        {hole && <span className="ml-2 text-gray-500">- {hole.hole_id}</span>}
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(activity.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                        to 
                        {new Date(activity.finished_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {activity.notes && <div className="mt-1 text-gray-700">{activity.notes}</div>}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => editActivity(idx)}
                        className="text-indigo-600 hover:text-indigo-800 p-1"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeActivity(idx)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button 
              type="submit" 
              className="inline-flex items-center rounded bg-indigo-600 text-white px-4 py-2" 
              disabled={loading || activities.length === 0}
            >
              {loading ? "Saving…" : "Save Shift & Activities"}
            </button>
            <button 
              type="button" 
              className="text-sm text-gray-600" 
              onClick={() => {
                setForm({ vendor_id: "", started_at: "", finished_at: "", notes: "" });
                setActivities([]);
                setActivityForm({ activity_type_id: "", hole_id: "", started_at: "", finished_at: "", notes: "" });
                setEditingActivityIndex(null);
                if (onClose) onClose();
              }}
            >
              Reset All
            </button>
          </div>
        </div>
      </form>
    );
  }

  // New Admin panel that contains Vendors + Activities sections (now with nested tabs)
  function AdminPanel() {
    const [adminTab, setAdminTab] = useState("vendors");

    return (
      <div className="space-y-6">
        {/* Admin nested tab bar */}
        <div className="flex border-b mb-4">
          <button
            className={`px-4 py-3 -mb-px ${adminTab === "vendors" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-600"}`}
            onClick={() => setAdminTab("vendors")}
          >
            Vendors
          </button>
          <button
            className={`px-4 py-3 -mb-px ${adminTab === "activities" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-600"}`}
            onClick={() => setAdminTab("activities")}
          >
            Activities
          </button>
        </div>

        {/* Vendors tab content */}
        {adminTab === "vendors" && (
          <div>
            <form onSubmit={submitVendor} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  value={vendorForm.name}
                  onChange={handleVendorChange("name")}
                  className="mt-1 block w-full rounded border p-2"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Contact</label>
                <input
                  value={vendorForm.contact}
                  onChange={handleVendorChange("contact")}
                  className="mt-1 block w-full rounded border p-2"
                />
              </div>
              <div className="md:col-span-1">
                <button
                  type="submit"
                  className="inline-flex items-center rounded bg-indigo-600 text-white px-4 py-2 w-full"
                  disabled={vendorLoading}
                >
                  {vendorLoading ? "Saving…" : "Add Vendor"}
                </button>
              </div>
            </form>

            <div className="mt-8">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Vendors & Resources</h3>
              <div className="space-y-2">
                {vendors.length === 0 && <div className="text-sm text-gray-500">No vendors yet.</div>}
                {vendors.map((vendor) => (
                  <div key={vendor.id} className="border rounded overflow-hidden">
                    <div
                      className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                      onClick={() => toggleVendorExpand(vendor.id)}
                    >
                      <div>
                        <div className="font-medium">{vendor.name}</div>
                        {vendor.contact && <div className="text-sm text-gray-500">{vendor.contact}</div>}
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-2">
                          {expandedVendor === vendor.id ? "Hide resources" : "Show resources"}
                        </span>
                        <svg
                          className={`w-5 h-5 transition-transform ${expandedVendor === vendor.id ? "transform rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {expandedVendor === vendor.id && (
                      <div className="p-3 border-t">
                        <div className="mb-3">
                          <button
                            onClick={() => openAddResourceModal(vendor.id)}
                            className="flex items-center text-sm text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Add New Resource
                          </button>
                        </div>

                        <div className="space-y-2">
                          {vendorResources.length === 0 ? (
                            <div className="text-sm text-gray-500 p-2">No resources added yet.</div>
                          ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {vendorResources.map((resource) => (
                                  <tr key={resource.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">{resource.name}</div>
                                      {resource.notes && <div className="text-xs text-gray-500 truncate max-w-xs">{resource.notes}</div>}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{resource.resource_type || "-"}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${resource.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                        {resource.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm">
                                      <button type="button" className="text-indigo-600 hover:text-indigo-900 mr-3" onClick={() => openEditResourceModal(resource)}>Edit</button>
                                      <button type="button" className="text-red-600 hover:text-red-900" onClick={() => deleteResource(resource.id)}>Delete</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Activities tab content */}
        {adminTab === "activities" && (
          <div>
            <form onSubmit={submitActivityType} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Activity Type</label>
                <input
                  value={activityTypeForm.activityType}
                  onChange={handleActivityTypeChange("activityType")}
                  placeholder="Activity Type (e.g. drilling, maintenance)"
                  className="mt-1 block w-full rounded border p-2"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Group</label>
                <input value={activityTypeForm.group} onChange={handleActivityTypeChange("group")} placeholder="Drilling" className="mt-1 block w-full rounded border p-2" />
              </div>
              <div className="md:col-span-1">
                <button type="submit" className="inline-flex items-center rounded bg-indigo-600 text-white px-4 py-2 w-full" disabled={activityTypeLoading}>
                  {activityTypeLoading ? "Saving…" : "Add Activity"}
                </button>
              </div>
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input value={activityTypeForm.description} onChange={handleActivityTypeChange("description")} placeholder="Optional activity description" className="mt-1 block w-full rounded border p-2" />
              </div>
            </form>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Existing Activity Types</h3>
              <div className="space-y-2">
                {activityTypes.length === 0 && <div className="text-sm text-gray-500">No activity types yet.</div>}
                {activityTypes.map((a) => (
                  <div key={a.id} className="flex items-center justify-between border rounded p-2">
                    <div>
                      <div className="font-medium">{a.activity_type}</div>
                      <div className="text-sm text-gray-500">{a.group && <span className="mr-2">{a.group}</span>}</div>
                      {a.description && <div className="text-sm text-gray-500 mt-1">{a.description}</div>}
                    </div>
                    <div className="text-sm text-gray-500">{/* actions could go here */}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function HistoryTable(props) {
    // ...existing code...
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Home</h3>

          {/* Enter New Plod button */}
          <button
            onClick={() => setShowNewPlod(true)}
            className="inline-flex items-center gap-2 rounded bg-indigo-600 text-white px-3 py-1.5 text-sm"
          >
            Enter New Plod
          </button>
        </div>

        {/* ...existing history listing ... */}

        {/* Slide-up drawer (overlay + panel) */}
        <div aria-hidden={!showNewPlod} className={`fixed inset-0 z-40 ${showNewPlod ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          {/* overlay */}
          <div
            onClick={() => setShowNewPlod(false)}
            className={`absolute inset-0 bg-black/40 transition-opacity ${showNewPlod ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* flexible container ensures the panel is kept within viewport */}
          <div className="fixed inset-0 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-8">
            <div
              className={`w-full max-w-3xl transform transition-transform duration-300 ${showNewPlod ? 'translate-y-0' : 'translate-y-full'}`}
            >
              <div
                className="bg-white rounded-t-xl sm:rounded-xl shadow-lg relative overflow-auto"
                style={{ maxHeight: 'calc(100vh - 5rem)', paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: '1rem' }}
              >
                {/* Top-right close button */}
                <button
                  type="button"
                  onClick={() => setShowNewPlod(false)}
                  aria-label="Close new plod form"
                  className="absolute top-3 right-3 inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-600 hover:bg-gray-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="px-4 pt-3 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-medium">New Plod</h4>
                  </div>

                  {/* Render the same Add Plod form here */}
                  <div className="pb-6">
                    <AddPlodForm onClose={() => setShowNewPlod(false)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
            <IconPlods />
          </span>
          Plods
        </h1>
        <p className="text-sm text-gray-600 mt-2">Record a driller's shift activities. Select vendor (optional), activity type, hole (optional), and times.</p>
      </header>

      <div className="bg-white rounded-lg border">
        {/* Tab bar */}
        <div className="flex border-b">
          <button
            className={`px-4 py-3 -mb-px ${activeTab === 'home' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'}`}
            onClick={() => {
              setActiveTab('home');
              if (orgId) loadPlods();
            }}
          >
            Home
          </button>
          <button
            className={`px-4 py-3 -mb-px ${activeTab === 'admin' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('admin')}
          >
            Admin
          </button>
        </div>

        <section className="p-6">
          {message && (
            <div className={`mb-4 p-3 rounded ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {message.text}
            </div>
          )}

          {activeTab === 'admin' && (
            <AdminPanel />
          )}

          {/* Home Tab Content (formerly History) */}
          {activeTab === 'home' && (
            <HistoryTable />
          )}
        </section>
      </div>

      {/* Resource Modal */}
      {resourceModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            {/* Background overlay (lower z) */}
            <div
              onClick={() => !resourceLoading && setResourceModalOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity z-40"
            />
            
            {/* Modal panel (above overlay) */}
            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full z-50">
              <form onSubmit={submitResource}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingResourceId ? 'Edit Resource' : 'Add New Resource'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Resource Name *</label>
                      <input
                        value={resourceForm.name}
                        onChange={(e) => setResourceForm(prev => ({ ...prev, name: e.target.value }))
                        }
                        className="mt-1 block w-full rounded border p-2"
                        placeholder="e.g., Drill Rig #1"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Resource Type</label>
                      <input
                        value={resourceForm.resource_type}
                        onChange={(e) => setResourceForm(prev => ({ ...prev, resource_type: e.target.value }))
                        }
                        className="mt-1 block w-full rounded border p-2"
                        placeholder="e.g., Drill / Vehicle / Team"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={resourceForm.status}
                        onChange={(e) => setResourceForm(prev => ({ ...prev, status: e.target.value }))
                        }
                        className="mt-1 block w-full rounded border p-2"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notes</label>
                      <textarea
                        value={resourceForm.notes}
                        onChange={(e) => setResourceForm(prev => ({ ...prev, notes: e.target.value }))
                        }
                        className="mt-1 block w-full rounded border p-2"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                    disabled={resourceLoading}
                  >
                    {resourceLoading ? 'Saving...' : editingResourceId ? 'Update Resource' : 'Add Resource'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => !resourceLoading && setResourceModalOpen(false)}
                    disabled={resourceLoading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
