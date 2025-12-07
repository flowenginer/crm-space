
-- Create the follow-up flow
INSERT INTO chatbot_flows (name, description, is_active, is_draft, priority)
VALUES (
  'Follow-up Inteligente para Leads',
  'Sequência automática de follow-up com intervalos de 10min, 30min, 4h e 24h. Para automaticamente quando o cliente responder.',
  true,
  false,
  10
);

-- Create nodes using a DO block to handle the UUIDs properly
DO $$
DECLARE
  v_flow_id uuid;
  v_trigger_id uuid;
  v_wait1_id uuid;
  v_msg1_id uuid;
  v_wait2_id uuid;
  v_msg2_id uuid;
  v_wait3_id uuid;
  v_msg3_id uuid;
  v_wait4_id uuid;
  v_msg4_id uuid;
  v_end1_id uuid;
  v_end2_id uuid;
  v_end3_id uuid;
  v_end4_id uuid;
  v_end_final_id uuid;
BEGIN
  -- Get the flow ID we just created
  SELECT id INTO v_flow_id FROM chatbot_flows WHERE name = 'Follow-up Inteligente para Leads' ORDER BY created_at DESC LIMIT 1;

  -- Create trigger node
  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Primeira Mensagem Recebida', 'trigger', 'first_message', 250, 50, '{}')
  RETURNING id INTO v_trigger_id;

  -- Wait 10min
  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Aguardar 10 minutos', 'delay', 'wait_reply', 250, 150, '{"duration": 10, "unit": "minutes", "timeout_minutes": 10}')
  RETURNING id INTO v_wait1_id;

  -- Follow-up 1
  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Follow-up 1', 'action', 'send_text', 250, 250, '{"message": "Olá! Vi que você entrou em contato conosco. Posso te ajudar com alguma informação? 😊"}')
  RETURNING id INTO v_msg1_id;

  -- Wait 30min
  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Aguardar 30 minutos', 'delay', 'wait_reply', 250, 350, '{"duration": 30, "unit": "minutes", "timeout_minutes": 30}')
  RETURNING id INTO v_wait2_id;

  -- Follow-up 2
  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Follow-up 2', 'action', 'send_text', 250, 450, '{"message": "Oi! Ainda estou por aqui caso precise de ajuda. Tem alguma dúvida que eu possa esclarecer?"}')
  RETURNING id INTO v_msg2_id;

  -- Wait 4h
  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Aguardar 4 horas', 'delay', 'wait_reply', 250, 550, '{"duration": 4, "unit": "hours", "timeout_minutes": 240}')
  RETURNING id INTO v_wait3_id;

  -- Follow-up 3
  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Follow-up 3', 'action', 'send_text', 250, 650, '{"message": "Olá novamente! Não quero ser inconveniente, mas gostaria de saber se posso te ajudar de alguma forma. Estou à disposição! 🙂"}')
  RETURNING id INTO v_msg3_id;

  -- Wait 24h
  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Aguardar 24 horas', 'delay', 'wait_reply', 250, 750, '{"duration": 24, "unit": "hours", "timeout_minutes": 1440}')
  RETURNING id INTO v_wait4_id;

  -- Follow-up Final
  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Follow-up Final', 'action', 'send_text', 250, 850, '{"message": "Oi! Esta é minha última tentativa de contato. Caso precise de algo no futuro, estarei por aqui. Abraços! 👋"}')
  RETURNING id INTO v_msg4_id;

  -- End nodes
  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Cliente Respondeu', 'end', 'end', 450, 150, '{}')
  RETURNING id INTO v_end1_id;

  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Cliente Respondeu', 'end', 'end', 450, 350, '{}')
  RETURNING id INTO v_end2_id;

  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Cliente Respondeu', 'end', 'end', 450, 550, '{}')
  RETURNING id INTO v_end3_id;

  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Cliente Respondeu', 'end', 'end', 450, 750, '{}')
  RETURNING id INTO v_end4_id;

  INSERT INTO flow_nodes (flow_id, name, node_type, node_subtype, position_x, position_y, config)
  VALUES (v_flow_id, 'Sequência Finalizada', 'end', 'end', 250, 950, '{}')
  RETURNING id INTO v_end_final_id;

  -- Create connections
  -- Trigger -> Wait 10min
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_trigger_id, v_wait1_id, 'default');

  -- Wait 10min: timeout -> msg1, replied -> end1
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_wait1_id, v_msg1_id, 'timeout');
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_wait1_id, v_end1_id, 'replied');

  -- Msg1 -> Wait 30min
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_msg1_id, v_wait2_id, 'default');

  -- Wait 30min: timeout -> msg2, replied -> end2
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_wait2_id, v_msg2_id, 'timeout');
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_wait2_id, v_end2_id, 'replied');

  -- Msg2 -> Wait 4h
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_msg2_id, v_wait3_id, 'default');

  -- Wait 4h: timeout -> msg3, replied -> end3
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_wait3_id, v_msg3_id, 'timeout');
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_wait3_id, v_end3_id, 'replied');

  -- Msg3 -> Wait 24h
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_msg3_id, v_wait4_id, 'default');

  -- Wait 24h: timeout -> msg4, replied -> end4
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_wait4_id, v_msg4_id, 'timeout');
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_wait4_id, v_end4_id, 'replied');

  -- Msg4 -> End Final
  INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, source_handle)
  VALUES (v_flow_id, v_msg4_id, v_end_final_id, 'default');

END $$;
