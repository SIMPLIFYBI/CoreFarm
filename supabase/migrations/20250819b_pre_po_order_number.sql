-- Pre-PO order number support and nullable po_id for requested items
-- Adds order_number to purchase_order_items and drops NOT NULL on po_id to allow pre-PO requests

alter table public.purchase_order_items
  add column if not exists order_number text;

-- Ensure items can exist before a PO is created
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'purchase_order_items' and column_name = 'po_id' and is_nullable = 'NO'
  ) then
    alter table public.purchase_order_items alter column po_id drop not null;
  end if;
end $$;

create index if not exists idx_po_items_order_number on public.purchase_order_items(organization_id, order_number);
