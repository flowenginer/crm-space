import { describe, it, expect } from 'vitest';
import {
  buildTemplateComponentsPayload,
  countTemplateVars,
  type TemplateComponent,
} from '../meta-template-payload';
import { buildTemplateComponentsPayload as buildClient } from '@/lib/scheduled-template-utils';

describe('edge buildTemplateComponentsPayload (shared Deno)', () => {
  it('body com 2 vars', () => {
    const components: TemplateComponent[] = [
      { type: 'BODY', text: 'Oi {{1}}, seu pedido {{2}}' },
    ];
    expect(
      buildTemplateComponentsPayload(components, { '1': 'Lu', '2': '#42' }, null),
    ).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Lu' },
          { type: 'text', text: '#42' },
        ],
      },
    ]);
  });

  it('header IMAGE com url', () => {
    const components: TemplateComponent[] = [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'BODY', text: 'Ola {{1}}' },
    ];
    const result = buildTemplateComponentsPayload(
      components,
      { '1': 'Maria' },
      'https://cdn.example/a.jpg',
    );
    expect(result[0]).toEqual({
      type: 'header',
      parameters: [{ type: 'image', image: { link: 'https://cdn.example/a.jpg' } }],
    });
    expect(result[1].parameters[0].text).toBe('Maria');
  });

  it('header VIDEO com url', () => {
    const components: TemplateComponent[] = [
      { type: 'HEADER', format: 'VIDEO' },
    ];
    const result = buildTemplateComponentsPayload(
      components,
      {},
      'https://cdn.example/a.mp4',
    );
    expect(result[0].parameters[0]).toEqual({
      type: 'video',
      video: { link: 'https://cdn.example/a.mp4' },
    });
  });

  it('header DOCUMENT com filename default', () => {
    const components: TemplateComponent[] = [
      { type: 'HEADER', format: 'DOCUMENT' },
    ];
    const result = buildTemplateComponentsPayload(
      components,
      {},
      'https://cdn.example/a.pdf',
    );
    expect(result[0].parameters[0].document).toEqual({
      link: 'https://cdn.example/a.pdf',
      filename: 'documento',
    });
  });

  it('header TEXT com {{1}} + body {{1}} (offset)', () => {
    const components: TemplateComponent[] = [
      { type: 'HEADER', format: 'TEXT', text: 'Oi {{1}}' },
      { type: 'BODY', text: 'Pedido {{1}}' },
    ];
    const result = buildTemplateComponentsPayload(
      components,
      { '1': 'Lu', '2': '#42' },
      null,
    );
    expect(result).toEqual([
      { type: 'header', parameters: [{ type: 'text', text: 'Lu' }] },
      { type: 'body', parameters: [{ type: 'text', text: '#42' }] },
    ]);
  });

  it('throw quando header IMAGE sem url', () => {
    const components: TemplateComponent[] = [{ type: 'HEADER', format: 'IMAGE' }];
    expect(() => buildTemplateComponentsPayload(components, {}, null)).toThrow(
      /midia do cabecalho/i,
    );
    expect(() => buildTemplateComponentsPayload(components, {}, '  ')).toThrow(
      /midia do cabecalho/i,
    );
  });

  it('throw quando var nao preenchida', () => {
    const components: TemplateComponent[] = [{ type: 'BODY', text: 'Oi {{1}}' }];
    expect(() => buildTemplateComponentsPayload(components, {}, null)).toThrow(
      /\{\{1\}\}/,
    );
  });

  it('template sem HEADER nem vars retorna vazio', () => {
    expect(
      buildTemplateComponentsPayload(
        [{ type: 'BODY', text: 'Ola, tudo bem?' }],
        {},
        null,
      ),
    ).toEqual([]);
  });
});

describe('countTemplateVars', () => {
  it('retorna max index, nao contagem', () => {
    expect(countTemplateVars('Oi {{1}} e {{3}}')).toBe(3);
  });
  it('retorna 0 quando sem var', () => {
    expect(countTemplateVars('Oi tudo bem')).toBe(0);
    expect(countTemplateVars(null)).toBe(0);
    expect(countTemplateVars(undefined)).toBe(0);
  });
});

describe('paridade edge vs client', () => {
  const cases: Array<{
    name: string;
    components: TemplateComponent[];
    variables: Record<string, string>;
    headerMediaUrl: string | null;
  }> = [
    {
      name: 'body simples',
      components: [{ type: 'BODY', text: 'Oi {{1}}' }],
      variables: { '1': 'Ana' },
      headerMediaUrl: null,
    },
    {
      name: 'header IMAGE + body',
      components: [
        { type: 'HEADER', format: 'IMAGE' },
        { type: 'BODY', text: 'Obrigado {{1}}' },
      ],
      variables: { '1': 'Joao' },
      headerMediaUrl: 'https://x.com/a.jpg',
    },
    {
      name: 'header TEXT var + body vars (offset)',
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Oi {{1}}' },
        { type: 'BODY', text: 'Pedido {{1}} saiu em {{2}}' },
      ],
      variables: { '1': 'Mari', '2': '#123', '3': '10h' },
      headerMediaUrl: null,
    },
    {
      name: 'header DOCUMENT com url stored (client resolve via header_media_url, edge via payload)',
      components: [{ type: 'HEADER', format: 'DOCUMENT' }],
      variables: {},
      headerMediaUrl: 'https://x.com/doc.pdf',
    },
  ];

  for (const c of cases) {
    it(`paridade: ${c.name}`, () => {
      const edge = buildTemplateComponentsPayload(
        c.components,
        c.variables,
        c.headerMediaUrl,
      );
      const client = buildClient(
        {
          components: c.components as unknown as never,
          header_media_url: c.headerMediaUrl,
        },
        c.variables,
        c.headerMediaUrl,
      );
      expect(edge).toEqual(client);
    });
  }
});
