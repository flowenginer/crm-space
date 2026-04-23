import { describe, it, expect } from 'vitest';
import type { MetaMessageTemplate } from '@/hooks/useMetaTemplates';
import {
  buildTemplateComponentsPayload,
  countTotalTemplateVariables,
  renderTemplatePreview,
} from '../scheduled-template-utils';

type Template = Pick<MetaMessageTemplate, 'components' | 'header_media_url'>;

const baseTemplate = (
  components: MetaMessageTemplate['components'],
  header_media_url: string | null = null,
): Template => ({ components, header_media_url });

describe('buildTemplateComponentsPayload', () => {
  it('retorna array vazio quando template so tem BODY sem variaveis', () => {
    const tpl = baseTemplate([{ type: 'BODY', text: 'Ola, tudo bem?' }]);
    expect(buildTemplateComponentsPayload(tpl, {})).toEqual([]);
  });

  it('monta body com 2 parameters quando BODY tem {{1}} e {{2}}', () => {
    const tpl = baseTemplate([
      { type: 'BODY', text: 'Oi {{1}}, sobre o pedido {{2}}' },
    ]);
    const result = buildTemplateComponentsPayload(tpl, { '1': 'Marcilene', '2': '#123' });
    expect(result).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Marcilene' },
          { type: 'text', text: '#123' },
        ],
      },
    ]);
  });

  it('monta header IMAGE com link do stored header_media_url quando nao ha override', () => {
    const tpl = baseTemplate(
      [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Ola {{1}}' },
      ],
      'https://cdn.example/img.jpg',
    );
    const result = buildTemplateComponentsPayload(tpl, { '1': 'Lu' });
    expect(result).toEqual([
      { type: 'header', parameters: [{ type: 'image', image: { link: 'https://cdn.example/img.jpg' } }] },
      { type: 'body', parameters: [{ type: 'text', text: 'Lu' }] },
    ]);
  });

  it('override de headerMediaUrl prevalece sobre stored', () => {
    const tpl = baseTemplate(
      [{ type: 'HEADER', format: 'IMAGE' }],
      'https://cdn.example/old.jpg',
    );
    const result = buildTemplateComponentsPayload(tpl, {}, 'https://cdn.example/new.jpg');
    expect(result[0].parameters[0].image?.link).toBe('https://cdn.example/new.jpg');
  });

  it('throw quando header IMAGE sem nenhuma URL disponivel', () => {
    const tpl = baseTemplate([{ type: 'HEADER', format: 'IMAGE' }]);
    expect(() => buildTemplateComponentsPayload(tpl, {})).toThrow(/midia do cabecalho/i);
  });

  it('throw quando variavel nao preenchida', () => {
    const tpl = baseTemplate([{ type: 'BODY', text: 'Oi {{1}}' }]);
    expect(() => buildTemplateComponentsPayload(tpl, {})).toThrow(/\{\{1\}\}/);
  });

  it('header TEXT com {{1}} + body com {{1}} trata offset: body usa {{2}}', () => {
    const tpl = baseTemplate([
      { type: 'HEADER', format: 'TEXT', text: 'Oi {{1}}' },
      { type: 'BODY', text: 'Pedido {{1}}' },
    ]);
    const result = buildTemplateComponentsPayload(tpl, { '1': 'Lu', '2': '#42' });
    expect(result).toEqual([
      { type: 'header', parameters: [{ type: 'text', text: 'Lu' }] },
      { type: 'body', parameters: [{ type: 'text', text: '#42' }] },
    ]);
  });

  it('header DOCUMENT usa filename default', () => {
    const tpl = baseTemplate(
      [{ type: 'HEADER', format: 'DOCUMENT' }],
      'https://cdn.example/file.pdf',
    );
    const result = buildTemplateComponentsPayload(tpl, {});
    expect(result[0].parameters[0].document).toEqual({
      link: 'https://cdn.example/file.pdf',
      filename: 'documento',
    });
  });
});

describe('renderTemplatePreview', () => {
  it('junta header + body + footer com quebras de linha duplas', () => {
    const tpl: Pick<MetaMessageTemplate, 'components'> = {
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Promo' },
        { type: 'BODY', text: 'Oi {{1}}, confere ai!' },
        { type: 'FOOTER', text: 'Space Sports' },
      ],
    };
    expect(renderTemplatePreview(tpl, { '1': 'Marcilene' })).toBe(
      'Promo\n\nOi Marcilene, confere ai!\n\nSpace Sports',
    );
  });

  it('usa placeholder quando var ausente no preview', () => {
    const tpl = { components: [{ type: 'BODY' as const, text: 'Oi {{1}}' }] };
    expect(renderTemplatePreview(tpl, {})).toBe('Oi {{1}}');
  });

  it('header TEXT com var consome indice antes do body', () => {
    const tpl = {
      components: [
        { type: 'HEADER' as const, format: 'TEXT' as const, text: 'Oi {{1}}' },
        { type: 'BODY' as const, text: 'Pedido {{1}}' },
      ],
    };
    expect(renderTemplatePreview(tpl, { '1': 'Lu', '2': '#42' })).toBe('Oi Lu\n\nPedido #42');
  });
});

describe('countTotalTemplateVariables', () => {
  it('soma vars do header TEXT + body', () => {
    const components: MetaMessageTemplate['components'] = [
      { type: 'HEADER', format: 'TEXT', text: 'Oi {{1}}' },
      { type: 'BODY', text: 'Seu pedido {{1}} saiu em {{2}}' },
    ];
    expect(countTotalTemplateVariables(components)).toBe(3);
  });

  it('ignora vars em header nao-TEXT', () => {
    const components: MetaMessageTemplate['components'] = [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Oi {{1}}' },
    ];
    expect(countTotalTemplateVariables(components)).toBe(1);
  });
});
