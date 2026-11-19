import type { MessageTemplate, ContentBlock } from '@/hooks/useTemplates';

/**
 * Exporta mensagens rápidas como um backup completo (.zip):
 *  - mensagens-rapidas.xlsx  → uma linha por mensagem, texto idêntico ao CRM
 *                              (formatação do WhatsApp *negrito*, _itálico_,
 *                              emojis e quebras de linha preservados)
 *  - mensagens-rapidas.json  → dados completos, na estrutura do banco, para
 *                              reimportação
 *  - anexos/                 → arquivos de mídia baixados
 *  - LEIA-ME.txt             → explicação do conteúdo (e falhas de download)
 */

export interface ExportProgress {
  done: number;
  total: number;
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'application/pdf': 'pdf',
};

function sanitizeFileName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'sem-nome'
  );
}

function extensionFor(url: string, mime: string | null, mediaName: string | null): string {
  const fromName = mediaName?.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  const fromUrl = url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();
  const base = mime?.split(';')[0].trim().toLowerCase();
  return (base && MIME_EXT[base]) || 'bin';
}

function getBlocks(t: MessageTemplate): ContentBlock[] {
  if (Array.isArray(t.content_blocks) && t.content_blocks.length > 0) return t.content_blocks;
  return [{ type: 'text', content: t.content }];
}

interface MediaRef {
  url: string;
  mediaType: string | null;
  mediaName: string | null;
  label: string; // usado no nome do arquivo
}

function getMediaRefs(t: MessageTemplate): MediaRef[] {
  const refs: MediaRef[] = [];
  if (t.media_url) {
    refs.push({ url: t.media_url, mediaType: t.media_type, mediaName: t.media_name, label: '' });
  }
  getBlocks(t).forEach((b, i) => {
    if (b.media_url && b.media_url !== t.media_url) {
      refs.push({ url: b.media_url, mediaType: b.media_type ?? null, mediaName: null, label: ` - bloco ${i + 1}` });
    }
  });
  return refs;
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
}

export async function exportQuickMessagesZip(
  templates: MessageTemplate[],
  onProgress?: (p: ExportProgress) => void,
): Promise<{ fileName: string; mediaOk: number; mediaFailed: number }> {
  const [{ default: JSZip }, XLSX] = await Promise.all([import('jszip'), import('xlsx')]);
  const zip = new JSZip();
  const anexos = zip.folder('anexos')!;

  const ordered = [...templates];
  const pad = String(ordered.length).length < 3 ? 3 : String(ordered.length).length;

  // 1) Baixa anexos (em paralelo, com limite) e registra onde cada um ficou
  const jobs: { templateId: string; ref: MediaRef; index: number }[] = [];
  ordered.forEach((t, i) => getMediaRefs(t).forEach((ref) => jobs.push({ templateId: t.id, ref, index: i })));

  const savedPaths = new Map<string, string[]>(); // templateId -> caminhos no zip
  const failures: string[] = [];
  let done = 0;
  onProgress?.({ done, total: jobs.length });

  const CONCURRENCY = 4;
  let cursor = 0;
  const usedNames = new Set<string>();
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const t = ordered[job.index];
      const num = String(job.index + 1).padStart(pad, '0');
      try {
        const res = await fetch(job.ref.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.arrayBuffer();
        const ext = extensionFor(job.ref.url, res.headers.get('content-type'), job.ref.mediaName);
        let name = `${num} - ${sanitizeFileName(t.title)}${job.ref.label}.${ext}`;
        for (let n = 2; usedNames.has(name); n++) {
          name = `${num} - ${sanitizeFileName(t.title)}${job.ref.label} (${n}).${ext}`;
        }
        usedNames.add(name);
        anexos.file(name, data);
        const list = savedPaths.get(job.templateId) ?? [];
        list.push(`anexos/${name}`);
        savedPaths.set(job.templateId, list);
      } catch (e) {
        failures.push(`${num} - ${t.title}: ${job.ref.url} (${e instanceof Error ? e.message : 'erro'})`);
      } finally {
        done++;
        onProgress?.({ done, total: jobs.length });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

  // 2) Planilha
  const maxBlocks = Math.max(1, ...ordered.map((t) => getBlocks(t).filter((b) => b.type === 'text').length));
  const rows = ordered.map((t, i) => {
    const textBlocks = getBlocks(t).filter((b) => b.type === 'text');
    const row: Record<string, string | number> = {
      'Nº': i + 1,
      Chave: t.title,
      Pasta: t.folder?.name ?? '',
      Favorita: t.is_favorite ? 'Sim' : 'Não',
      'Áudio primeiro': t.audio_first ? 'Sim' : 'Não',
    };
    for (let b = 0; b < maxBlocks; b++) row[`Bloco ${b + 1}`] = textBlocks[b]?.content ?? '';
    const refs = getMediaRefs(t);
    row['Tipo do anexo'] = refs.map((r) => r.mediaType ?? '').filter(Boolean).join(', ');
    row['Nome do anexo'] = refs.map((r) => r.mediaName ?? '').filter(Boolean).join(', ');
    row['Arquivo no ZIP'] = (savedPaths.get(t.id) ?? []).join(', ');
    row['Link original'] = refs.map((r) => r.url).join(', ');
    row['Usos'] = t.usage_count ?? 0;
    row['Criada em'] = t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : '';
    row['Atualizada em'] = t.updated_at ? new Date(t.updated_at).toLocaleString('pt-BR') : '';
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] ?? { 'Nº': 0 }).map((k) =>
    k.startsWith('Bloco') ? { wch: 60 } : k === 'Chave' ? { wch: 30 } : k === 'Nº' ? { wch: 5 } : { wch: 18 },
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mensagens rápidas');
  const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  zip.file('mensagens-rapidas.xlsx', xlsxData);

  // 3) JSON completo
  zip.file(
    'mensagens-rapidas.json',
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        format_version: 1,
        total: ordered.length,
        templates: ordered.map((t) => ({ ...t, exported_files: savedPaths.get(t.id) ?? [] })),
      },
      null,
      2,
    ),
  );

  // 4) LEIA-ME
  const mediaOk = jobs.length - failures.length;
  zip.file(
    'LEIA-ME.txt',
    [
      'Backup das Mensagens Rápidas do CRM',
      `Exportado em: ${new Date().toLocaleString('pt-BR')}`,
      `Mensagens: ${ordered.length}`,
      `Anexos baixados: ${mediaOk} de ${jobs.length}`,
      '',
      'mensagens-rapidas.xlsx  -> uma linha por mensagem. O texto está exatamente como no CRM:',
      '                           *negrito*, _itálico_, ~riscado~ e emojis do WhatsApp.',
      '                           Colado no WhatsApp, a formatação aparece normalmente.',
      'mensagens-rapidas.json  -> dados completos (blocos, ordem, áudio primeiro, anexos),',
      '                           para reimportar em outro sistema.',
      'anexos/                 -> arquivos de mídia, nomeados com o número e a chave da mensagem.',
      ...(failures.length
        ? ['', 'ANEXOS QUE NÃO PUDERAM SER BAIXADOS (o link original continua na planilha):', ...failures]
        : []),
      '',
    ].join('\r\n'),
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const fileName = `mensagens-rapidas_${stamp()}.zip`;
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return { fileName, mediaOk, mediaFailed: failures.length };
}
