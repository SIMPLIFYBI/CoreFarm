-- Add name to purchase_orders for pre-PO identification
alter table public.purchase_orders add column if not exists name text;

-- Optional helpful index if filtering by name often
create index if not exists idx_purchase_orders_name on public.purchase_orders(name);
