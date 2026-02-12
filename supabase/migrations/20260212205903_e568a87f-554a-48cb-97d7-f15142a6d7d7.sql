
UPDATE contacts
SET custom_fields = jsonb_set(
  COALESCE(custom_fields, '{}'::jsonb),
  '{conversoes}',
  jsonb_build_array(
    jsonb_build_object(
      'total', negotiated_value,
      'data', '2026-02-12',
      'numero_pedido', '',
      'cidade', COALESCE(custom_fields->>'cidade', ''),
      'uf', COALESCE(custom_fields->>'uf', ''),
      'vendedor', COALESCE(custom_fields->>'vendedor', '')
    )
  )
),
updated_at = now()
WHERE lead_status IN ('07 - Pedido Fechado', '08 - Em andamento', '09 - Cobrança', '10 - Aguardando envio', '11 - Pedido Enviado', '12 - Entregue')
AND negotiated_value > 0
AND (custom_fields IS NULL OR NOT (custom_fields ? 'conversoes') OR custom_fields->'conversoes' = '[]'::jsonb);
