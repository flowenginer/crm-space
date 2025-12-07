
-- Inserir tags faltantes para vendedores ativos
INSERT INTO tags (name, color, visibility, description) VALUES
('BRENDO', '#3B82F6', 'public', 'Tag do vendedor Brendo'),
('DEBORAH', '#EC4899', 'public', 'Tag da vendedora Deborah'),
('LARA', '#F59E0B', 'public', 'Tag da vendedora Lara Martins'),
('LORRAINE', '#10B981', 'public', 'Tag da vendedora Lorraine'),
('RAFIK', '#8B5CF6', 'public', 'Tag do vendedor Rafik'),
('YASMIN', '#06B6D4', 'public', 'Tag da vendedora Yasmin Sant''Anna')
ON CONFLICT DO NOTHING;
