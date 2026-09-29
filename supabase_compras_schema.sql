-- ==============================================================================
-- SCHEMA DA TABELA DE COMPRAS / AQUISIÇÕES - MONITORIA SESI
-- ==============================================================================
-- Execute este script no Editor SQL do seu painel Supabase para criar a tabela
-- de solicitações de compras com suporte a RLS (Row Level Security).

CREATE TABLE IF NOT EXISTS public.purchase_requests (
    id TEXT PRIMARY KEY,
    requester_name TEXT NOT NULL,
    requester_department TEXT,
    requester_contact TEXT,
    item_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'un',
    reference_link TEXT NOT NULL,
    justification TEXT NOT NULL,
    technical_specs TEXT,
    estimated_price NUMERIC,
    priority TEXT DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' (Em Espera), 'approved' (Aprovado), 'rejected' (Reprovado)
    rejection_reason TEXT,
    approval_notes TEXT,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DROP POLICY IF EXISTS "Permitir leitura de compras" ON public.purchase_requests;
CREATE POLICY "Permitir leitura de compras" 
ON public.purchase_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir criacao de compras" ON public.purchase_requests;
CREATE POLICY "Permitir criacao de compras" 
ON public.purchase_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de compras" ON public.purchase_requests;
CREATE POLICY "Permitir atualizacao de compras" 
ON public.purchase_requests FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusao de compras" ON public.purchase_requests;
CREATE POLICY "Permitir exclusao de compras" 
ON public.purchase_requests FOR DELETE USING (true);

-- Habilitar Realtime para a tabela purchase_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_requests;
