-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.activity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hole_id uuid,
  task_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT activity_pkey PRIMARY KEY (id),
  CONSTRAINT activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT activity_hole_id_fkey FOREIGN KEY (hole_id) REFERENCES public.holes(id),
  CONSTRAINT activity_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.app_admins (
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT app_admins_pkey PRIMARY KEY (user_id),
  CONSTRAINT app_admins_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT app_admins_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.asset_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  changed_by uuid,
  change_type text NOT NULL,
  change_details jsonb,
  changed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT asset_history_pkey PRIMARY KEY (id),
  CONSTRAINT asset_history_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id),
  CONSTRAINT asset_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT asset_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.asset_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT asset_locations_pkey PRIMARY KEY (id),
  CONSTRAINT asset_locations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT asset_locations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.asset_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT asset_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  asset_type text NOT NULL,
  value numeric,
  location_id uuid,
  next_service_date date,
  service_interval_months integer,
  status text,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  asset_type_id uuid,
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT assets_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.asset_locations(id),
  CONSTRAINT assets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id),
  CONSTRAINT assets_asset_type_id_fkey FOREIGN KEY (asset_type_id) REFERENCES public.asset_types(id)
);
CREATE TABLE public.consumable_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at timestamp with time zone DEFAULT now(),
  include_in_report boolean NOT NULL DEFAULT false,
  reorder_value integer NOT NULL DEFAULT 0 CHECK (reorder_value >= 0),
  cost_per_unit numeric NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0::numeric),
  unit_size integer NOT NULL DEFAULT 1 CHECK (unit_size > 0),
  CONSTRAINT consumable_items_pkey PRIMARY KEY (id),
  CONSTRAINT consumable_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.contract_activity_types (
  contract_id uuid NOT NULL,
  activity_type_id uuid NOT NULL,
  billable_override boolean,
  rate_override numeric CHECK (rate_override IS NULL OR rate_override >= 0::numeric),
  rate_period_override text CHECK (rate_period_override IS NULL OR (rate_period_override = ANY (ARRAY['hourly'::text, 'daily'::text, 'weekly'::text, 'monthly'::text]))),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contract_activity_types_pkey PRIMARY KEY (contract_id, activity_type_id),
  CONSTRAINT contract_activity_types_contract_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id),
  CONSTRAINT contract_activity_types_activity_fkey FOREIGN KEY (activity_type_id) REFERENCES public.plod_activity_types(id)
);
CREATE TABLE public.contract_resources (
  contract_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT contract_resources_pkey PRIMARY KEY (contract_id, resource_id),
  CONSTRAINT contract_resources_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id),
  CONSTRAINT contract_resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT contract_resources_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id)
);
CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_organization_id uuid NOT NULL,
  vendor_organization_id uuid NOT NULL,
  name text NOT NULL,
  contract_number text,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'closed'::text, 'cancelled'::text])),
  starts_on date,
  ends_on date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contracts_pkey PRIMARY KEY (id),
  CONSTRAINT contracts_client_organization_id_fkey FOREIGN KEY (client_organization_id) REFERENCES public.organizations(id),
  CONSTRAINT contracts_vendor_organization_id_fkey FOREIGN KEY (vendor_organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.drillhole_annulus_intervals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  hole_id uuid NOT NULL,
  annulus_type_id uuid NOT NULL,
  from_m numeric NOT NULL,
  to_m numeric NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  depth_range numrange DEFAULT numrange(from_m, to_m, '[)'::text),
  CONSTRAINT drillhole_annulus_intervals_pkey PRIMARY KEY (id),
  CONSTRAINT drillhole_annulus_intervals_annulus_type_id_fkey FOREIGN KEY (annulus_type_id) REFERENCES public.drillhole_annulus_types(id),
  CONSTRAINT drillhole_annulus_intervals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT drillhole_annulus_intervals_hole_fk FOREIGN KEY (organization_id) REFERENCES public.holes(id),
  CONSTRAINT drillhole_annulus_intervals_hole_fk FOREIGN KEY (hole_id) REFERENCES public.holes(id),
  CONSTRAINT drillhole_annulus_intervals_hole_fk FOREIGN KEY (organization_id) REFERENCES public.holes(organization_id),
  CONSTRAINT drillhole_annulus_intervals_hole_fk FOREIGN KEY (hole_id) REFERENCES public.holes(organization_id)
);
CREATE TABLE public.drillhole_annulus_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT drillhole_annulus_types_pkey PRIMARY KEY (id),
  CONSTRAINT drillhole_annulus_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT drillhole_annulus_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.drillhole_construction_intervals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  hole_id uuid NOT NULL,
  construction_type_id uuid NOT NULL,
  from_m numeric NOT NULL,
  to_m numeric NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  depth_range numrange DEFAULT numrange(from_m, to_m, '[)'::text),
  CONSTRAINT drillhole_construction_intervals_pkey PRIMARY KEY (id),
  CONSTRAINT drillhole_construction_intervals_construction_type_id_fkey FOREIGN KEY (construction_type_id) REFERENCES public.drillhole_construction_types(id),
  CONSTRAINT drillhole_construction_intervals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT drillhole_construction_intervals_hole_fk FOREIGN KEY (organization_id) REFERENCES public.holes(id),
  CONSTRAINT drillhole_construction_intervals_hole_fk FOREIGN KEY (hole_id) REFERENCES public.holes(id),
  CONSTRAINT drillhole_construction_intervals_hole_fk FOREIGN KEY (organization_id) REFERENCES public.holes(organization_id),
  CONSTRAINT drillhole_construction_intervals_hole_fk FOREIGN KEY (hole_id) REFERENCES public.holes(organization_id)
);
CREATE TABLE public.drillhole_construction_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT drillhole_construction_types_pkey PRIMARY KEY (id),
  CONSTRAINT drillhole_construction_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT drillhole_construction_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.drillhole_geology_intervals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  hole_id uuid NOT NULL,
  lithology_type_id uuid NOT NULL,
  from_m numeric NOT NULL,
  to_m numeric NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  depth_range numrange DEFAULT numrange(from_m, to_m, '[)'::text),
  CONSTRAINT drillhole_geology_intervals_pkey PRIMARY KEY (id),
  CONSTRAINT drillhole_geology_intervals_lithology_type_id_fkey FOREIGN KEY (lithology_type_id) REFERENCES public.drillhole_lithology_types(id),
  CONSTRAINT drillhole_geology_intervals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT drillhole_geology_intervals_hole_fk FOREIGN KEY (organization_id) REFERENCES public.holes(id),
  CONSTRAINT drillhole_geology_intervals_hole_fk FOREIGN KEY (hole_id) REFERENCES public.holes(id),
  CONSTRAINT drillhole_geology_intervals_hole_fk FOREIGN KEY (organization_id) REFERENCES public.holes(organization_id),
  CONSTRAINT drillhole_geology_intervals_hole_fk FOREIGN KEY (hole_id) REFERENCES public.holes(organization_id)
);
CREATE TABLE public.drillhole_lithology_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT drillhole_lithology_types_pkey PRIMARY KEY (id),
  CONSTRAINT drillhole_lithology_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT drillhole_lithology_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.drillhole_sensor_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  color text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT drillhole_sensor_types_pkey PRIMARY KEY (id),
  CONSTRAINT drillhole_sensor_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT drillhole_sensor_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.drillhole_sensors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  hole_id uuid NOT NULL,
  sensor_type_id uuid NOT NULL,
  depth_m numeric NOT NULL CHECK (depth_m >= 0::numeric),
  label text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT drillhole_sensors_pkey PRIMARY KEY (id),
  CONSTRAINT drillhole_sensors_sensor_type_id_fkey FOREIGN KEY (sensor_type_id) REFERENCES public.drillhole_sensor_types(id),
  CONSTRAINT drillhole_sensors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT drillhole_sensors_hole_fk FOREIGN KEY (organization_id) REFERENCES public.holes(id),
  CONSTRAINT drillhole_sensors_hole_fk FOREIGN KEY (hole_id) REFERENCES public.holes(id),
  CONSTRAINT drillhole_sensors_hole_fk FOREIGN KEY (organization_id) REFERENCES public.holes(organization_id),
  CONSTRAINT drillhole_sensors_hole_fk FOREIGN KEY (hole_id) REFERENCES public.holes(organization_id)
);
CREATE TABLE public.hole_task_intervals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hole_id uuid NOT NULL,
  task_type text NOT NULL CHECK (task_type = ANY (ARRAY['orientation'::text, 'magnetic_susceptibility'::text, 'whole_core_sampling'::text, 'cutting'::text, 'rqd'::text, 'specific_gravity'::text])),
  from_m numeric NOT NULL,
  to_m numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hole_task_intervals_pkey PRIMARY KEY (id),
  CONSTRAINT hole_task_intervals_hole_id_fkey FOREIGN KEY (hole_id) REFERENCES public.holes(id)
);
CREATE TABLE public.hole_task_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hole_id uuid NOT NULL,
  task_type text NOT NULL CHECK (task_type = ANY (ARRAY['orientation'::text, 'magnetic_susceptibility'::text, 'whole_core_sampling'::text, 'cutting'::text, 'rqd'::text, 'specific_gravity'::text])),
  from_m numeric NOT NULL,
  to_m numeric NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  interval numrange DEFAULT numrange(from_m, to_m, '[)'::text),
  logged_on date DEFAULT CURRENT_DATE,
  CONSTRAINT hole_task_progress_pkey PRIMARY KEY (id),
  CONSTRAINT hole_task_progress_hole_id_fkey FOREIGN KEY (hole_id) REFERENCES public.holes(id),
  CONSTRAINT hole_task_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.holes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hole_id text NOT NULL,
  depth numeric,
  drilling_diameter text CHECK (drilling_diameter IS NULL OR (drilling_diameter = ANY (ARRAY['NQ'::text, 'HQ'::text, 'PQ'::text, 'Other'::text]))) NOT VALI),
  drilling_contractor text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  organization_id uuid,
  project_id uuid,
  tenement_id uuid,
  planned_depth numeric CHECK (planned_depth IS NULL OR planned_depth >= 0::numeric),
  state text NOT NULL DEFAULT 'proposed'::text CHECK (state = ANY (ARRAY['proposed'::text, 'in_progress'::text, 'drilled'::text])),
  CONSTRAINT holes_pkey PRIMARY KEY (id),
  CONSTRAINT holes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT holes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT holes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT holes_tenement_id_fkey FOREIGN KEY (tenement_id) REFERENCES public.tenements(id)
);
CREATE TABLE public.organization_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member'::text CHECK (role = ANY (ARRAY['admin'::text, 'member'::text])),
  invited_by uuid,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'revoked'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organization_invites_pkey PRIMARY KEY (id),
  CONSTRAINT organization_invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT organization_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id)
);
CREATE TABLE public.organization_members (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member'::text CHECK (role = ANY (ARRAY['admin'::text, 'member'::text])),
  added_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organization_members_pkey PRIMARY KEY (organization_id, user_id),
  CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT organization_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id)
);
CREATE TABLE public.organization_relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_organization_id uuid NOT NULL,
  vendor_organization_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::org_relationship_status,
  permissions jsonb NOT NULL DEFAULT jsonb_build_object('share_project_details', false, 'share_plods', false, 'share_rates', false, 'allow_invoicing', false),
  invited_by uuid DEFAULT auth.uid(),
  invited_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organization_relationships_pkey PRIMARY KEY (id),
  CONSTRAINT organization_relationships_vendor_fkey FOREIGN KEY (vendor_organization_id) REFERENCES public.organizations(id),
  CONSTRAINT organization_relationships_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id),
  CONSTRAINT organization_relationships_client_fkey FOREIGN KEY (client_organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.organization_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'expired'::text, 'cancelled'::text])),
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  ends_at timestamp with time zone,
  term_months integer CHECK (term_months IS NULL OR term_months > 0),
  po_number text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organization_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT organization_subscriptions_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT organization_subscriptions_plan_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id),
  CONSTRAINT organization_subscriptions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  organization_type text NOT NULL DEFAULT 'client'::text CHECK (organization_type = ANY (ARRAY['client'::text, 'vendor'::text, 'both'::text])),
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
CREATE TABLE public.plod_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plod_id uuid NOT NULL,
  activity_type_id uuid NOT NULL,
  hole_id uuid,
  started_at timestamp with time zone NOT NULL,
  finished_at timestamp with time zone NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plod_activities_pkey PRIMARY KEY (id),
  CONSTRAINT plod_activities_plod_id_fkey FOREIGN KEY (plod_id) REFERENCES public.plods(id),
  CONSTRAINT plod_activities_activity_type_id_fkey FOREIGN KEY (activity_type_id) REFERENCES public.plod_activity_types(id),
  CONSTRAINT plod_activities_hole_id_fkey FOREIGN KEY (hole_id) REFERENCES public.holes(id)
);
CREATE TABLE public.plod_activity_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  activity_type text NOT NULL,
  description text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  group text,
  label text,
  plod_type_scope ARRAY DEFAULT ARRAY['all'::text] CHECK (plod_type_scope <@ ARRAY['all'::text, 'drill_blast'::text, 'drilling_geology'::text, 'load_haul'::text, 'general_works'::text]),
  billable boolean NOT NULL DEFAULT false,
  rate numeric,
  rate_period text CHECK (rate_period IS NULL OR (rate_period = ANY (ARRAY['hourly'::text, 'daily'::text, 'weekly'::text, 'monthly'::text]))),
  CONSTRAINT plod_activity_types_pkey PRIMARY KEY (id),
  CONSTRAINT plod_activity_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT plod_activity_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.plod_type_activity_types (
  plod_type_id uuid NOT NULL,
  activity_type_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT plod_type_activity_types_pkey PRIMARY KEY (plod_type_id, activity_type_id),
  CONSTRAINT plod_type_activity_types_plod_type_id_fkey FOREIGN KEY (plod_type_id) REFERENCES public.plod_types(id),
  CONSTRAINT plod_type_activity_types_activity_type_id_fkey FOREIGN KEY (activity_type_id) REFERENCES public.plod_activity_types(id)
);
CREATE TABLE public.plod_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  code text,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT plod_types_pkey PRIMARY KEY (id),
  CONSTRAINT plod_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.plods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  vendor_id uuid,
  hole_id uuid,
  started_at timestamp with time zone NOT NULL,
  finished_at timestamp with time zone NOT NULL,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  plod_type text,
  contract_id uuid,
  client_organization_id uuid,
  vendor_organization_id uuid,
  resource_id uuid,
  plod_type_id uuid,
  shift_date date,
  CONSTRAINT plods_pkey PRIMARY KEY (id),
  CONSTRAINT plods_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT plods_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
  CONSTRAINT plods_hole_id_fkey FOREIGN KEY (hole_id) REFERENCES public.holes(id),
  CONSTRAINT plods_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT plods_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id),
  CONSTRAINT plods_client_organization_id_fkey FOREIGN KEY (client_organization_id) REFERENCES public.organizations(id),
  CONSTRAINT plods_vendor_organization_id_fkey FOREIGN KEY (vendor_organization_id) REFERENCES public.organizations(id),
  CONSTRAINT plods_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id),
  CONSTRAINT plods_plod_type_id_fkey FOREIGN KEY (plod_type_id) REFERENCES public.plod_types(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  start_date date,
  finish_date date,
  cost_code text,
  wbs_code text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.purchase_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  po_id uuid,
  item_key text NOT NULL,
  label text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'outstanding'::text CHECK (status = ANY (ARRAY['outstanding'::text, 'ordered'::text, 'received'::text])),
  created_at timestamp with time zone DEFAULT now(),
  order_number text,
  CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_order_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT purchase_order_items_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id)
);
CREATE TABLE public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  po_number text,
  status text NOT NULL DEFAULT 'not_ordered'::text CHECK (status = ANY (ARRAY['not_ordered'::text, 'ordered'::text, 'received'::text])),
  ordered_date date,
  received_date date,
  comments text,
  created_at timestamp with time zone DEFAULT now(),
  name text,
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.resource_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  title text,
  details text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  interval daterange DEFAULT daterange(start_date, end_date, '[)'::text),
  CONSTRAINT resource_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT resource_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT resource_assignments_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resources(id),
  CONSTRAINT resource_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  resource_type text CHECK (resource_type = ANY (ARRAY['Drill Rig'::text, 'Dump Truck'::text, 'General Earthworks'::text, 'Ancillary'::text, 'Water Cart'::text, 'Other'::text])),
  vendor_id uuid,
  CONSTRAINT resources_pkey PRIMARY KEY (id),
  CONSTRAINT resources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT resources_vendor_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
);
CREATE TABLE public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tenements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  tenement_number text NOT NULL,
  tenement_type text,
  application_number text,
  status text,
  date_applied date,
  date_granted date,
  renewal_date date,
  expenditure_commitment numeric,
  heritage_agreements text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tenements_pkey PRIMARY KEY (id),
  CONSTRAINT tenements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT tenements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.vendor_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  resource_type text,
  status text NOT NULL DEFAULT 'Active'::text CHECK (status = ANY (ARRAY['Active'::text, 'Inactive'::text])),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vendor_resources_pkey PRIMARY KEY (id),
  CONSTRAINT vendor_resources_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id),
  CONSTRAINT vendor_resources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT vendor_resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.vendors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  contact text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  linked_organization_id uuid,
  CONSTRAINT vendors_pkey PRIMARY KEY (id),
  CONSTRAINT vendors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT vendors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT vendors_linked_organization_id_fkey FOREIGN KEY (linked_organization_id) REFERENCES public.organizations(id)
);