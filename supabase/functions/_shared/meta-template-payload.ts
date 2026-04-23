// Shared payload builder for WhatsApp Cloud API template messages.
// Deno-compatible: no external imports. Also imported by Vitest tests.
// Mirror of client-side src/lib/scheduled-template-utils.ts (build function only).

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: unknown[];
}

export interface TemplatePayloadParameter {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string; filename?: string };
}

export interface TemplatePayloadComponent {
  type: 'header' | 'body';
  parameters: TemplatePayloadParameter[];
}

export function countTemplateVars(text: string | undefined | null): number {
  if (!text) return 0;
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return 0;
  return matches
    .map((m) => parseInt(m.replace(/[{}]/g, ''), 10))
    .reduce((max, n) => (n > max ? n : max), 0);
}

export function buildTemplateComponentsPayload(
  components: TemplateComponent[],
  variables: Record<string, string>,
  headerMediaUrl: string | null,
): TemplatePayloadComponent[] {
  const out: TemplatePayloadComponent[] = [];
  const header = components.find((c) => c.type === 'HEADER');
  const body = components.find((c) => c.type === 'BODY');

  const getVar = (i: number): string => {
    const v = variables[String(i)];
    if (v === undefined || v === null) {
      throw new Error(`Variavel {{${i}}} nao preenchida`);
    }
    return v;
  };

  if (header) {
    if (header.format === 'TEXT') {
      const varCount = countTemplateVars(header.text);
      if (varCount > 0) {
        const parameters: TemplatePayloadParameter[] = [];
        for (let i = 1; i <= varCount; i++) {
          parameters.push({ type: 'text', text: getVar(i) });
        }
        out.push({ type: 'header', parameters });
      }
    } else if (
      header.format === 'IMAGE' ||
      header.format === 'VIDEO' ||
      header.format === 'DOCUMENT'
    ) {
      const link = (headerMediaUrl || '').trim();
      if (!link) {
        throw new Error('URL de midia do cabecalho obrigatoria para este template');
      }
      const parameter: TemplatePayloadParameter =
        header.format === 'IMAGE'
          ? { type: 'image', image: { link } }
          : header.format === 'VIDEO'
            ? { type: 'video', video: { link } }
            : { type: 'document', document: { link, filename: 'documento' } };
      out.push({ type: 'header', parameters: [parameter] });
    }
  }

  if (body) {
    const headerVarCount =
      header?.format === 'TEXT' ? countTemplateVars(header.text) : 0;
    const bodyVarCount = countTemplateVars(body.text);
    if (bodyVarCount > 0) {
      const parameters: TemplatePayloadParameter[] = [];
      for (let i = 1; i <= bodyVarCount; i++) {
        parameters.push({ type: 'text', text: getVar(headerVarCount + i) });
      }
      out.push({ type: 'body', parameters });
    }
  }

  return out;
}
