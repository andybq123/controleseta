
-- 1) Nova tabela assuntos
CREATE TABLE public.assuntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  grupo text,
  secretaria_id uuid REFERENCES public.secretarias(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assuntos TO authenticated;
GRANT ALL ON public.assuntos TO service_role;

ALTER TABLE public.assuntos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem assuntos" ON public.assuntos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados gerenciam assuntos" ON public.assuntos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_assuntos_updated_at
  BEFORE UPDATE ON public.assuntos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_assuntos_secretaria ON public.assuntos(secretaria_id);

-- 2) Seed do catálogo
-- Helper: dado um nome de secretaria, devolve o id (lowercase + unaccent leve).
-- Como unaccent pode não existir, comparamos por lower() apenas — os nomes do seed
-- batem com os do banco.
WITH sec AS (
  SELECT id, lower(nome) AS k FROM public.secretarias
),
seed(nome, grupo, sec_nome) AS (
  VALUES
    ('Assistência Social', 'Assistência Social', 'SDS - Assistencia Social'),
    ('Conduta de Funcionários', 'Conduta de Funcionários', 'SAGE RH'),
    ('Creches e Escolas', 'Creches e Escolas', 'SME - Educação'),
    ('Denúncia de Assédio', 'Denúncia de Assédio', 'SAGE RH'),
    ('Esgoto', 'Esgoto', 'Administração/SAMAE'),
    ('Condição sanitária irregular', 'Estabelecimento irregular', 'Saúde'),
    ('Estabelecimento com acessibilidade irregular', 'Estabelecimento irregular', 'SEPLAN'),
    ('Estabelecimento irregular', 'Estabelecimento irregular', NULL),
    ('Estabelecimento sem alvará', 'Estabelecimento irregular', 'SEFAZ'),
    ('Estabelecimento sem nota fiscal', 'Estabelecimento irregular', 'PROCON'),
    ('Estabelecimento sem saída de emergência', 'Estabelecimento irregular', 'Defesa Civil'),
    ('Falta de Higiene', 'Falta de Higiene', 'Saúde'),
    ('Mercadorias vencidas', 'Mercadorias vencidas', 'PROCON'),
    ('Ocupação irregular de área pública', 'Ocupação irregular de área pública', 'SEPLAN'),
    ('Abuso de poder', 'Governo', 'Controladoria'),
    ('Demora em processo', 'Governo', 'Controladoria'),
    ('Desorganização', 'Governo', 'Controladoria'),
    ('Desvio de função', 'Governo', 'Controladoria'),
    ('Desvio de verba pública', 'Governo', 'Controladoria'),
    ('Nepotismo', 'Governo', 'Controladoria'),
    ('Iluminação e Energia', 'Iluminação e Energia', 'SIE - Infraestrutura Estratégica'),
    ('Coleta de Lixo Comum', 'Limpeza e Conservação', 'Secretaria de Obras'),
    ('Coleta pesada', 'Limpeza e Conservação', 'Secretaria de Obras'),
    ('Entulho em via pública', 'Limpeza e Conservação', 'Secretaria de Obras'),
    ('Limpeza em terreno baldio', 'Limpeza e Conservação', 'Secretaria de Obras'),
    ('Limpeza urbana', 'Limpeza e Conservação', 'Secretaria de Obras'),
    ('Mato alto', 'Limpeza e Conservação', 'Secretaria de Obras'),
    ('Poda de árvores de rua', 'Limpeza e Conservação', 'Secretaria de Obras'),
    ('Aterro sanitário irregular', 'Meio Ambiente', 'Fundema'),
    ('Desmatamento irregular', 'Meio Ambiente', 'Fundema'),
    ('Maus tratos a animais', 'Meio Ambiente', 'Bem-Estar Animal'),
    ('Poluição Ambiental', 'Meio Ambiente', 'Fundema'),
    ('Queimada irregular', 'Meio Ambiente', 'Fundema'),
    ('Pagamentos', 'Pagamentos', 'SEFAZ'),
    ('Praça e/ou quadra para lazer e esportes', 'Praça e/ou quadra para lazer e esportes', 'Esportes'),
    ('Programas Sociais', 'Programas Sociais', 'SDS - Assistencia Social'),
    ('Recursos Humanos', 'Recursos Humanos', 'SAGE RH'),
    ('Demora em marcar consulta / procedimento', 'Saúde', 'Saúde'),
    ('Falta de materiais em Posto de Saúde', 'Saúde', 'Saúde'),
    ('Falta de medicação', 'Saúde', 'Saúde'),
    ('Foco de dengue', 'Saúde', 'Saúde'),
    ('Infestação / Proliferação de animais ou pragas', 'Saúde', 'Saúde'),
    ('Médicos', 'Saúde', 'Saúde'),
    ('Postos de Saúde', 'Saúde', 'Saúde'),
    ('Transporte para tratamento', 'Saúde', 'Saúde'),
    ('Vacinas', 'Saúde', 'Saúde'),
    ('Baderna', 'Segurança', NULL),
    ('Ponto de assalto/roubo', 'Segurança', NULL),
    ('Ponto de tráfico de drogas', 'Segurança', NULL),
    ('Risco de desmoronamento', 'Segurança', 'Defesa Civil'),
    ('Acessibilidade para deficientes visuais', 'Trânsito e Vias', NULL),
    ('Asfalto', 'Trânsito e Vias', 'Secretaria de Obras'),
    ('Bloqueio na via', 'Trânsito e Vias', NULL),
    ('Buraco', 'Trânsito e Vias', 'Secretaria de Obras'),
    ('Calçadas', 'Trânsito e Vias', 'Secretaria de Obras'),
    ('Estacionamento irregular', 'Trânsito e Vias', NULL),
    ('Faixa de pedestre', 'Trânsito e Vias', NULL),
    ('Lombadas', 'Trânsito e Vias', NULL),
    ('Placas de sinalização', 'Trânsito e Vias', NULL),
    ('Semáforos', 'Trânsito e Vias', NULL),
    ('Via sem pavimentação (Estrada de chão)', 'Trânsito e Vias', 'Secretaria de Obras'),
    ('Horários', 'Transporte Público', NULL),
    ('Ônibus danificado', 'Transporte Público', NULL),
    ('Ponto de ônibus', 'Transporte Público', NULL),
    ('Super-lotação', 'Transporte Público', NULL),
    ('Transporte irregular', 'Transporte Público', NULL),
    ('Construção Irregular', 'Urbanismo e Infraestrutura', 'SEPLAN'),
    ('Demora em Obra Pública', 'Urbanismo e Infraestrutura', 'Secretaria de Obras'),
    ('Fiscalização de Obras', 'Urbanismo e Infraestrutura', 'SEPLAN'),
    ('Imóvel abandonado', 'Urbanismo e Infraestrutura', 'SEPLAN'),
    ('Invasão de área pública', 'Urbanismo e Infraestrutura', 'SEPLAN'),
    ('Serviço mal feito', 'Urbanismo e Infraestrutura', 'Secretaria de Obras')
)
INSERT INTO public.assuntos (nome, grupo, secretaria_id)
SELECT s.nome, s.grupo, sec.id
FROM seed s
LEFT JOIN sec ON sec.k = lower(s.sec_nome);

-- 3) Remover responsaveis
ALTER TABLE public.protocolos DROP COLUMN IF EXISTS responsavel_id;
DROP TABLE IF EXISTS public.responsaveis;

-- 4) Remover centro_custo
ALTER TABLE public.secretarias DROP COLUMN IF EXISTS centro_custo;
