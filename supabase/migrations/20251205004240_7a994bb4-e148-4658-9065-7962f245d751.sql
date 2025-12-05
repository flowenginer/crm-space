-- Inserir mensagens de resposta que faltaram na conversa do Danilo (vendas-08)
-- conversation_id: a74e189c-12ff-453f-ba5e-c716e7c2676f
-- contact_id: ae42dff1-8755-4c2e-bfbe-65e8836002c3

INSERT INTO messages (conversation_id, contact_id, content, message_type, is_from_me, status, created_at)
VALUES 
  -- Mensagens recuperadas do webhook_logs
  ('a74e189c-12ff-453f-ba5e-c716e7c2676f', 'ae42dff1-8755-4c2e-bfbe-65e8836002c3', 
   'Entendi. Você está enfrentando problemas com preços altos e dificuldades relacionadas à entrega e pagamentos antecipados.', 
   'text', true, 'sent', '2025-12-05 00:32:30+00'),
   
  ('a74e189c-12ff-453f-ba5e-c716e7c2676f', 'ae42dff1-8755-4c2e-bfbe-65e8836002c3', 
   'Realmente, isso pode causar frustração e impactar a confiança na relação com os fornecedores. Estamos aqui para encontrar a melhor solução para você e garantir que sua experiência seja positiva.', 
   'text', true, 'sent', '2025-12-05 00:32:34+00'),
   
  ('a74e189c-12ff-453f-ba5e-c716e7c2676f', 'ae42dff1-8755-4c2e-bfbe-65e8836002c3', 
   'Pra começar o atendimento e já te mostrar as opções certas, me diz seu nome, por gentileza? 🙂', 
   'text', true, 'sent', '2025-12-05 00:32:37+00'),
   
  ('a74e189c-12ff-453f-ba5e-c716e7c2676f', 'ae42dff1-8755-4c2e-bfbe-65e8836002c3', 
   'Perfeito, Danilo! 👊', 
   'text', true, 'sent', '2025-12-05 00:39:36+00'),
   
  ('a74e189c-12ff-453f-ba5e-c716e7c2676f', 'ae42dff1-8755-4c2e-bfbe-65e8836002c3', 
   'Entendo, Danilo! Agradeço sua paciência. 👊 O valor final depende do modelo e da quantidade.', 
   'text', true, 'sent', '2025-12-05 00:38:39+00'),
   
  ('a74e189c-12ff-453f-ba5e-c716e7c2676f', 'ae42dff1-8755-4c2e-bfbe-65e8836002c3', 
   'Qual modelo você prefere? Manga Curta, Manga Longa ou Regata? 🤔', 
   'text', true, 'sent', '2025-12-05 00:38:50+00')
ON CONFLICT DO NOTHING;