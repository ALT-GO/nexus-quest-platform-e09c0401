
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department TEXT NOT NULL,
  sc_number TEXT,
  pc_number TEXT,
  cost_center TEXT,
  description TEXT NOT NULL,
  opening_date DATE,
  status TEXT,
  finalization_date DATE,
  finalization_note TEXT,
  insumo TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_orders_department ON public.purchase_orders(department);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view purchase orders"
  ON public.purchase_orders FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert purchase orders"
  ON public.purchase_orders FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update purchase orders"
  ON public.purchase_orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete purchase orders"
  ON public.purchase_orders FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_updated_at();
