
DO $$
DECLARE
  t uuid := '664dfcb4-5432-4c14-9838-7db14360cabf';
  ch uuid := 'ed6f2c8c-7339-4e92-8948-3f74baf280df';
  d timestamptz := '2026-02-12 12:00:00-03';
  cid uuid;
  vid uuid;
  actual_msg text;
  r RECORD;
  ig1 text := E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias';
  ig2 text := E'Url: https://www.instagram.com/p/DUDkSZUjBCD/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias';
  ig3 text := E'Url: https://www.instagram.com/p/DUDkSYDjGLp/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias';
  fb1 text := E'Url: https://fb.me/5G25YnwGU\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias';
  v_count_contacts int := 0;
  v_count_convs int := 0;
  v_count_msgs int := 0;
BEGIN
  CREATE TEMP TABLE _leads (name text, phone text, msg_type int, msg_custom text, lstatus text) ON COMMIT DROP;

  INSERT INTO _leads VALUES
  ('🤫😅🥰','5521971441469',0,'Bommdia vcs só encaminham jovens',NULL),
  ('Jessi 🤎✨','5521993476433',0,'Bom dia','Pré-contato'),
  ('Isabela ❤','5524992821508',0,'Oi bom dia',NULL),
  ('Michele Costa','5521976549285',5,NULL,'Pré-contato'),
  ('𝙂𝙖𝙗𝙮','5521977062462',0,'oii','Pré-contato'),
  ('Fern🇧🇷','5521976356949',0,'Gostaria de mais informações','Pré-contato'),
  ('Jana 🍓','5521976240806',4,NULL,'Pré-contato'),
  ('❣️Mota ❣️','5521976945182',0,'Bom dia',NULL),
  ('Paixaum','5521997988774',0,'ola','Pré-contato'),
  ('Thais 🥰','5521987847442',0,'Olá','Pré-contato'),
  ('Viih❤️🥺','5521968234580',1,NULL,'Pré-contato'),
  ('Luiz Henrique bg','5521960193130',0,'Bom dia','Pré-contato'),
  ('~biazinha ~','5522992511149',1,NULL,'Pré-contato'),
  ('Cabral 🍃☀️','5521976515993',1,NULL,'Pré-contato'),
  ('Mily','5521991246299',1,NULL,'Pré-contato'),
  ('📵❓','5521965303456',0,'Olaa',NULL),
  ('* Lani Catarino *','5521985875159',0,'Bom dia!','Pré-contato'),
  ('Lucas Cardeal','5521975998706',1,NULL,'Pré-contato'),
  ('ana','5521967014739',2,NULL,'Pré-contato'),
  ('Rafaela','5521978951032',1,NULL,'Pré-contato'),
  ('5521981098688','5521981098688',5,NULL,NULL),
  ('😘 Fanny&Marcos❤️','5521990764177',0,'Bom dia','Pré-contato'),
  ('manoela','5521974748413',1,NULL,'Pré-contato'),
  ('Kauã, Gabriela e Heloísa','5521980885732',0,'Oi bom dia','Pré-contato'),
  ('5521986669120','5521986669120',0,'Oiii','Pré-contato'),
  ('ju','5521993460283',1,NULL,'Pré-contato'),
  ('Joyce','5521983084181',1,NULL,'Pré-contato'),
  ('Martins','5521967680434',1,NULL,NULL),
  ('Jessyca💕','5521989033744',1,NULL,'Pré-contato'),
  ('manu','5521999203457',0,'Boa tarde','Pré-contato'),
  ('Thifany Silva❤️‍🔥','5521988044165',0,'boa tarde','Pré-contato'),
  ('Daniele','5521994682836',0,'Bom dia','Pré-contato'),
  ('😶‍🌫️','5521991651046',1,NULL,'Pré-contato'),
  ('V🌻Ldet🌻 Mun🌻Z','5521989044776',0,'Boa tarde!','Pré-contato'),
  ('~loloh🤍','5521993465109',1,NULL,'Pré-contato'),
  ('Nayara Rodrigues','5521970453991',0,'Oi boa tarde eu segui a página de vocês no estragam sobre vagas de emprego',NULL),
  ('Lucas 💭','5521980917197',0,'Olá','Pré-contato'),
  ('Vitória 🤍','5521968180647',1,NULL,'Pré-contato'),
  ('Ashley❤️','5521966062003',1,NULL,'Pré-contato'),
  ('~Dn*','5521991135510',1,NULL,'Pré-contato'),
  ('João Lucas','5521990594049',1,NULL,'Pré-contato'),
  ('Maycon B.','5521971573740',3,NULL,'Pré-contato'),
  ('klebin','5521986907125',0,'Boa tarde! Gostaria de informações sobre como me inscrever para o Jovem Aprendiz, o que é necessário, etc.','Pré-contato'),
  ('ㅤ','5521981793502',3,NULL,'Pré-contato'),
  ('Thiago Soares','5521992962927',1,NULL,'Pré-contato'),
  ('kamilly❤️','5521979139355',1,NULL,'Pré-contato'),
  ('Olympio','5521979921103',1,NULL,NULL),
  ('Myh','5521968665497',1,NULL,'Pré-contato'),
  ('Larih Cartomante','5521982948138',0,'Olá boa tarde','Pré-contato'),
  ('maria','5521986956445',1,NULL,'Pré-contato'),
  ('Hiarley','5521979132305',0,'Oi','Pré-contato'),
  ('Julia 🪐⃤','5521971001651',1,NULL,'Pré-contato'),
  ('clarissa','5521996508321',3,NULL,'Pré-contato'),
  ('chica silva 💕','5521966785898',4,NULL,'Pré-contato'),
  ('Neusa','5521991822627',0,'Boa tarde','Pré-contato'),
  ('nelma','5521999693415',0,'Oii boa tarde','Pré-contato'),
  ('Cleyzer','5521996466346',2,NULL,'Pré-contato'),
  ('Weslei','5521965766402',0,'Boa tarde','Pré-contato'),
  ('.','5521970140027',1,NULL,'Pré-contato'),
  ('Ana','5521998428844',1,NULL,'Pré-contato'),
  ('.','5521977662885',2,NULL,'Pré-contato'),
  ('claudiasantosverduras','5521970851728',2,NULL,NULL),
  ('𝖄𝖆𝖘𝖒𝖎𝖓','5521985745797',1,NULL,'Pré-contato'),
  ('bn_branquinho_022','5521977301401',0,'Oi boa tarde','Pré-contato'),
  ('gabs~','5521981324198',1,NULL,NULL),
  ('Dudinha','5521986408836',0,'Boa tarde','Pré-contato'),
  ('𝓣𝓱𝓪𝔂𝓵𝓪 𝔀𝓪𝓵𝓹𝓪𝓼𝓼𝓸𝓼','5521994004622',1,NULL,NULL),
  ('Ana Júlia','5521989074540',0,'Boa tarde','Pré-contato'),
  ('Kaka','5521971298293',0,'Olá, gostaria de fazer minha inscrição gratuita!',NULL),
  ('Kayllane','5521994722733',1,NULL,'Pré-contato'),
  ('𝖊𝖒𝖊','5521970803394',0,'oiii, boa tarde','Pré-contato'),
  ('Vivian','5521995562001',1,NULL,'Pré-contato'),
  ('sena💯','5521977134161',1,NULL,'Pré-contato'),
  ('Kamilly','5521988195845',1,NULL,'Pré-contato'),
  ('Débora Souza','5521999568009',2,NULL,'Pré-contato'),
  ('𝙅𝙤ã𝙤 𝙊𝙡𝙞𝙫𝙚𝙞𝙧𝙖 🧞👑','5521985928600',1,NULL,NULL),
  ('Mayllane Oliveira❤️','5521983429702',1,NULL,'Pré-contato'),
  ('Vinícius','5521997404935',0,'Oi','Pré-contato'),
  ('.','5521993152315',0,'Boa tarde',NULL),
  ('Manu','5521996014016',0,'boa noite','Pré-contato'),
  ('Caio','5521979457237',0,'Boa noite','Pré-contato'),
  ('PH','5521992907374',1,NULL,'Pré-contato'),
  ('Jéssica🤍','5521986037102',4,NULL,'Pré-contato'),
  ('Victoria Souza','5521972962517',0,'Boa noite','Pré-contato'),
  ('João','5521971295884',1,NULL,NULL),
  ('Anna Júlia','5521966074064',0,'Olá, boa noite! me chamo Anna Júlia, tenho 14 anos, vi o anúncio de vocês no Instagram, e tenho interesse na vaga, estou passando aqui para deixar o meu currículo, e se vocês estiverem interesse, irei agradecer o retorno! uma boa noite para vocês','Pré-contato'),
  ('Alx','5521984627113',0,'Boa noite','Pré-contato'),
  ('Anna Beatriz','5521991230988',3,NULL,'Pré-contato'),
  ('Wøllët','5521965040837',0,'Boa noite! Queria saber mais sobre o programa do empregamais','Pré-contato'),
  ('Mona lisa','5521981429685',0,'Como eu consigo o meu primeiro emprego de jovem aprendiz?','Pré-contato'),
  ('Vih','5521977496873',1,NULL,'Pré-contato'),
  ('Luciana Fernandes','5521967603562',0,'Oi',NULL);

  FOR r IN SELECT * FROM _leads LOOP
    CASE r.msg_type
      WHEN 0 THEN actual_msg := r.msg_custom;
      WHEN 1 THEN actual_msg := ig1;
      WHEN 2 THEN actual_msg := ig2;
      WHEN 3 THEN actual_msg := ig3;
      WHEN 4 THEN actual_msg := fb1;
      WHEN 5 THEN actual_msg := NULL;
    END CASE;

    SELECT id INTO cid FROM contacts WHERE phone = r.phone AND tenant_id = t LIMIT 1;
    IF cid IS NULL THEN
      INSERT INTO contacts (full_name, phone, tenant_id, created_at, updated_at, contact_type, lead_status)
      VALUES (r.name, r.phone, t, d, d, 'customer', r.lstatus)
      RETURNING id INTO cid;
      v_count_contacts := v_count_contacts + 1;
    END IF;

    SELECT id INTO vid FROM conversations
    WHERE contact_id = cid AND channel_id = ch AND tenant_id = t LIMIT 1;

    IF vid IS NULL THEN
      INSERT INTO conversations (contact_id, channel_id, status, tenant_id, created_at, updated_at, last_client_message_at, last_message_at, last_message_preview, is_unread, unread_count)
      VALUES (cid, ch, 'open', t, d, d, d, d, LEFT(actual_msg, 100), true, CASE WHEN actual_msg IS NOT NULL THEN 1 ELSE 0 END)
      RETURNING id INTO vid;
      v_count_convs := v_count_convs + 1;
    END IF;

    IF actual_msg IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM messages WHERE conversation_id = vid AND tenant_id = t LIMIT 1) THEN
        INSERT INTO messages (conversation_id, content, is_from_me, message_type, status, tenant_id, created_at)
        VALUES (vid, actual_msg, false, 'text', 'delivered', t, d);
        v_count_msgs := v_count_msgs + 1;

        UPDATE conversations SET
          last_client_message_at = d,
          last_message_preview = LEFT(actual_msg, 100),
          last_message_at = d,
          is_unread = true,
          unread_count = 1
        WHERE id = vid;
      END IF;
    END IF;

    cid := NULL;
    vid := NULL;
    actual_msg := NULL;
  END LOOP;

  RAISE NOTICE 'Importação concluída: % contatos criados, % conversas criadas, % mensagens inseridas', v_count_contacts, v_count_convs, v_count_msgs;
END $$;
