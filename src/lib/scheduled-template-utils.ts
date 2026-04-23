import type {
  MetaMessageTemplate,
  MetaTemplateComponent,
} from '@/hooks/useMetaTemplates';

export interface TemplateVariables {
  [key: string]: string;
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

function countVariables(text: string | undefined | null): number {
  if (!text) return 0;
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return 0;
  return matches
    .map((m) => parseInt(m.replace(/[{}]/g, ''), 10))
    .reduce((max, n) => (n > max ? n : max), 0);
}

function getVar(vars: TemplateVariables, index: number): string {
  const v = vars[String(index)];
  if (v === undefined || v === null) {
    throw new Error(`Variavel {{${index}}} nao preenchida`);
  }
  return v;
}

export function buildTemplateComponentsPayload(
  template: Pick<MetaMessageTemplate, 'components' | 'header_media_url'>,
  variables: TemplateVariables,
  headerMediaUrlOverride?: string | null,
): TemplatePayloadComponent[] {
  const out: TemplatePayloadComponent[] = [];
  const header = template.components.find((c) => c.type === 'HEADER');
  const body = template.components.find((c) => c.type === 'BODY');

  if (header) {
    if (header.format === 'TEXT') {
      const varCount = countVariables(header.text);
      if (varCount > 0) {
        const parameters: TemplatePayloadParameter[] = [];
        for (let i = 1; i <= varCount; i++) {
          parameters.push({ type: 'text', text: getVar(variables, i) });
        }
        out.push({ type: 'header', parameters });
      }
    } else if (header.format === 'IMAGE' || header.format === 'VIDEO' || header.format === 'DOCUMENT') {
      const link =
        (headerMediaUrlOverride && headerMediaUrlOverride.trim()) ||
        template.header_media_url ||
        null;
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
      header?.format === 'TEXT' ? countVariables(header.text) : 0;
    const bodyVarCount = countVariables(body.text);
    if (bodyVarCount > 0) {
      const parameters: TemplatePayloadParameter[] = [];
      for (let i = 1; i <= bodyVarCount; i++) {
        parameters.push({
          type: 'text',
          text: getVar(variables, headerVarCount + i),
        });
      }
      out.push({ type: 'body', parameters });
    }
  }

  return out;
}

export function renderTemplatePreview(
  template: Pick<MetaMessageTemplate, 'components'>,
  variables: TemplatePayloadParameter extends never ? never : TemplateVariables,
): string {
  const header = template.components.find((c) => c.type === 'HEADER');
  const body = template.components.find((c) => c.type === 'BODY');
  const footer = template.components.find((c) => c.type === 'FOOTER');

  const replace = (text: string, offset: number): string => {
    const count = countVariables(text);
    let out = text;
    for (let i = 1; i <= count; i++) {
      const absoluteIndex = offset + i;
      const value = variables[String(absoluteIndex)] ?? `{{${absoluteIndex}}}`;
      out = out.replace(new RegExp(`\\{\\{${i}\\}\\}`, 'g'), value);
    }
    return out;
  };

  const parts: string[] = [];
  let offset = 0;
  if (header?.format === 'TEXT' && header.text) {
    parts.push(replace(header.text, offset));
    offset += countVariables(header.text);
  }
  if (body?.text) {
    parts.push(replace(body.text, offset));
  }
  if (footer?.text) {
    parts.push(footer.text);
  }
  return parts.join('\n\n');
}

export function countTotalTemplateVariables(
  components: MetaTemplateComponent[],
): number {
  const header = components.find((c) => c.type === 'HEADER');
  const body = components.find((c) => c.type === 'BODY');
  const headerVars = header?.format === 'TEXT' ? countVariables(header.text) : 0;
  const bodyVars = countVariables(body?.text);
  return headerVars + bodyVars;
}
