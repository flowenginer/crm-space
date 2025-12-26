-- Fase 1: Deletar menu duplicado "Canais" que aponta para /settings?tab=channels
DELETE FROM menu_items WHERE module_key = 'settings_channels';