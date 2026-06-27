import type { LegalBlock, LegalDocRecord } from '@valloreg/shared';

// Renderează un document juridic structurat (blocuri) în HTML semantic.
// Server component (fără interactivitate). Stilizare cu tema brand existentă.

function Block({ block }: { block: LegalBlock }) {
  switch (block.k) {
    case 'h':
      return <h2 className="mt-10 text-xl font-bold text-anthracite-900">{block.t}</h2>;
    case 'p':
      return <p className="mt-4 text-sm leading-relaxed text-anthracite-600">{block.t}</p>;
    case 'ul':
      return (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-anthracite-600">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-anthracite-600">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      );
    case 'table':
      return (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-anthracite-200">
                {block.head.map((h, i) => (
                  <th key={i} className="py-2 pr-4 font-semibold text-anthracite-900">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-anthracite-100 align-top">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-2 pr-4 text-anthracite-600">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'note':
      return (
        <div className="mt-5 rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm leading-relaxed text-anthracite-700">
          <span className="mr-1 font-semibold text-primary-700">⚖️ Notă:</span>
          {block.t}
        </div>
      );
    default:
      return null;
  }
}

export function LegalDocView({ doc }: { doc: LegalDocRecord }) {
  return (
    <article className="container-page max-w-3xl py-12">
      <header className="border-b border-anthracite-100 pb-6">
        <h1 className="text-3xl font-bold text-anthracite-900">{doc.title}</h1>
        {doc.subtitle ? <p className="mt-2 text-base text-anthracite-500">{doc.subtitle}</p> : null}
        <p className="mt-3 text-xs text-anthracite-400">Ultima actualizare: {doc.updated}</p>
      </header>

      <div className="mt-2">
        {doc.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </article>
  );
}
