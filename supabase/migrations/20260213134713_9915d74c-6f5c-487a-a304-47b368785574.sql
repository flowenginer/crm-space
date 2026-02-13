
DO $$
DECLARE
  _tenant_id uuid := '664dfcb4-5432-4c14-9838-7db14360cabf';
  _channel_id uuid := 'ed6f2c8c-7339-4e92-8948-3f74baf280df';
  _r RECORD;
  _contact_id uuid;
  _conv_id uuid;
  _msg_exists boolean;
BEGIN
  -- Temporary table with spreadsheet data
  CREATE TEMP TABLE _lead_updates (
    phone text,
    full_name text,
    first_message text
  ) ON COMMIT DROP;

  INSERT INTO _lead_updates (phone, full_name, first_message) VALUES
    ('5521971441469', '🤫😅🥰', 'Bommdia vcs só encaminham jovens'),
    ('5521993476433', 'Jessi 🤎✨', 'Bom dia'),
    ('5524992821508', 'Isabela ❤', 'Oi bom dia'),
    ('5521976549285', 'Michele Costa', NULL),
    ('5521977062462', '𝙂𝙖𝙗𝙮', 'oii'),
    ('5521976356949', 'Fern🇧🇷', 'Gostaria de mais informações'),
    ('5521976240806', 'Jana 🍓', E'Url: https://fb.me/5G25YnwGU\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521976945182', '❣️Mota ❣️', 'Bom dia'),
    ('5521997988774', 'Paixaum', 'ola'),
    ('5521987847442', 'Thais 🥰', 'Olá'),
    ('5521968234580', 'Viih❤️🥺', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521960193130', 'Luiz Henrique bg', 'Bom dia'),
    ('5522992511149', '~biazinha ~', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521976515993', 'Cabral 🍃☀️', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521991246299', 'Mily', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521965303456', '📵❓', 'Olaa'),
    ('5521985875159', '* Lani Catarino *', 'Bom dia!'),
    ('5521975998706', 'Lucas Cardeal', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521967014739', 'ana', E'Url: https://www.instagram.com/p/DUDkSZUjBCD/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521978951032', 'Rafaela', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521981098688', '5521981098688', NULL),
    ('5521990764177', '😘 Fanny&Marcos❤️', 'Bom dia'),
    ('5521974748413', 'manoela', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521980885732', 'Kauã, Gabriela e Heloísa', 'Oi bom dia'),
    ('5521986669120', NULL, 'Oiii'),
    ('5521993460283', 'ju', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521983084181', 'Joyce', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521967680434', 'Martins', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521989033744', 'Jessyca💕', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521999203457', 'manu', 'Boa tarde'),
    ('5521988044165', 'Thifany Silva❤️‍🔥', 'boa tarde'),
    ('5521994682836', 'Daniele', 'Bom dia'),
    ('5521991651046', '😶‍🌫️', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521989044776', 'V🌻Ldet🌻 Mun🌻Z', 'Boa tarde!'),
    ('5521993465109', '~loloh🤍', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521970453991', 'Nayara Rodrigues', 'Oi boa tarde eu segui a página de vocês no estragam sobre vagas de emprego'),
    ('5521980917197', 'Lucas  💭', 'Olá'),
    ('5521968180647', 'Vitória 🤍', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521966062003', 'Ashley❤️', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521991135510', '~Dn*', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521990594049', 'João Lucas', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521971573740', 'Maycon B.', E'Url: https://www.instagram.com/p/DUDkSYDjGLp/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521986907125', 'klebin', 'Boa tarde! Gostaria de informações sobre como me inscrever para o Jovem Aprendiz, o que é necessário, etc.'),
    ('5521981793502', 'ㅤ', E'Url: https://www.instagram.com/p/DUDkSYDjGLp/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521992962927', 'Thiago Soares', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521979139355', 'kamilly❤️', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521979921103', 'Olympio', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521968665497', 'Myh', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521982948138', 'Larih Cartomante', 'Olá boa tarde'),
    ('5521986956445', 'maria', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521979132305', 'Hiarley', 'Oi'),
    ('5521971001651', 'Julia 🪐⃤', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521996508321', 'clarissa', E'Url: https://www.instagram.com/p/DUDkSYDjGLp/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521966785898', 'chica silva 💕', E'Url: https://fb.me/5G25YnwGU\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521991822627', 'Neusa', 'Boa tarde'),
    ('5521999693415', 'nelma', 'Oii boa tarde'),
    ('5521996466346', 'Cleyzer', E'Url: https://www.instagram.com/p/DUDkSZUjBCD/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521965766402', 'Weslei', 'Boa tarde'),
    ('5521970140027', '.', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521998428844', 'Ana', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521977662885', '.', E'Url: https://www.instagram.com/p/DUDkSZUjBCD/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521970851728', 'claudiasantosverduras', E'Url: https://www.instagram.com/p/DUDkSZUjBCD/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521985745797', '𝖄𝖆𝖘𝖒𝖎𝖓', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521977301401', 'bn_branquinho_022', 'Oi boa tarde'),
    ('5521981324198', 'gabs~', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521986408836', 'Dudinha', 'Boa tarde'),
    ('5521994004622', '𝓣𝓱𝓪𝔂𝓵𝓪 𝔀𝓪𝓵𝓹𝓪𝓼𝓼𝓸𝓼', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521989074540', 'Ana Júlia', 'Boa tarde'),
    ('5521971298293', 'Kaka', 'Olá, gostaria de fazer minha inscrição gratuita!'),
    ('5521994722733', 'Kayllane', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521970803394', '𝖊𝖒𝖊', 'oiii, boa tarde'),
    ('5521995562001', 'Vivian', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521977134161', 'sena💯', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521988195845', 'Kamilly', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521999568009', 'Débora Souza', E'Url: https://www.instagram.com/p/DUDkSZUjBCD/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521985928600', '𝙅𝙤ã𝙤 𝙊𝙡𝙞𝙫𝙚𝙞𝙧𝙖 🧞👑', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521983429702', 'Mayllane Oliveira❤️', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521997404935', 'Vinícius', 'Oi'),
    ('5521993152315', '.', 'Boa tarde'),
    ('5521996014016', 'Manu', 'boa noite'),
    ('5521979457237', 'Caio', 'Boa noite'),
    ('5521992907374', 'PH', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521986037102', 'Jéssica🤍', E'Url: https://fb.me/5G25YnwGU\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521972962517', 'Victoria Souza', 'Boa noite'),
    ('5521971295884', 'João', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521966074064', 'ㅤ', 'Olá, boa noite! me chamo Anna Júlia, tenho 14 anos, vi o anúncio de vocês no Instagram, e tenho interesse na vaga, estou passando aqui para deixar o meu currículo, e se vocês estiverem interesse, irei agradecer o retorno! uma boa noite para vocês'),
    ('5521984627113', 'Alx', 'Boa noite'),
    ('5521991230988', 'Anna Beatriz', E'Url: https://www.instagram.com/p/DUDkSYDjGLp/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521965040837', 'Wøllët', 'Boa noite! Queria saber mais sobre o programa do empregamais'),
    ('5521981429685', 'Mona lisa', 'Como eu consigo o meu primeiro emprego de jovem aprendiz?'),
    ('5521977496873', 'Vih', E'Url: https://www.instagram.com/p/DTyF4JNDC2Y/\ntitle: Participe Gratuitamente\n⚠️ Para Jovens de 14 a 21 anos de SG. Na palestra gratuita do Emprega Mais, seu filho já sai com encaminhamento direto para o CIEE!\n\nE o melhor: ainda pode garantir vaga no treinamento de 5 dias'),
    ('5521967603562', 'Luciana Fernandes', 'Oi');

  -- Loop: update name + ensure first message exists
  FOR _r IN SELECT * FROM _lead_updates LOOP
    -- Find contact
    SELECT id INTO _contact_id
    FROM contacts
    WHERE phone = _r.phone AND tenant_id = _tenant_id
    LIMIT 1;

    IF _contact_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Update name if provided
    IF _r.full_name IS NOT NULL THEN
      UPDATE contacts SET full_name = _r.full_name, updated_at = now()
      WHERE id = _contact_id;
    END IF;

    -- Find conversation in EMPREGA-MAIS channel
    SELECT id INTO _conv_id
    FROM conversations
    WHERE contact_id = _contact_id AND channel_id = _channel_id AND tenant_id = _tenant_id
    LIMIT 1;

    IF _conv_id IS NULL OR _r.first_message IS NULL THEN
      CONTINUE;
    END IF;

    -- Check if a message already exists for this conversation
    SELECT EXISTS(
      SELECT 1 FROM messages WHERE conversation_id = _conv_id AND tenant_id = _tenant_id
    ) INTO _msg_exists;

    IF _msg_exists THEN
      -- Update the earliest message content
      UPDATE messages
      SET content = _r.first_message
      WHERE id = (
        SELECT id FROM messages
        WHERE conversation_id = _conv_id AND tenant_id = _tenant_id
        ORDER BY created_at ASC LIMIT 1
      );
    ELSE
      -- Insert the first message
      INSERT INTO messages (conversation_id, tenant_id, content, sender_type, status, is_from_me, created_at)
      VALUES (_conv_id, _tenant_id, _r.first_message, 'contact', 'delivered', false, '2026-02-12T10:00:00Z');
    END IF;

    -- Update conversation preview
    UPDATE conversations
    SET last_message_preview = LEFT(_r.first_message, 100)
    WHERE id = _conv_id;

  END LOOP;
END $$;
