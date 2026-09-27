import { DocumentationLinks } from "./DocumentationLinks";
import { documentation, docNavigation, SUPPORT_URL, type DocId } from "@/lib/documentation";

export function DocumentationPage({ pageId }: { pageId: DocId }) {
  const page = documentation[pageId];
  return (
    <div className="docs-shell">
      <a className="docs-skip" href="#doc-content">
        Skip to content
      </a>
      <header className="docs-header">
        <a className="docs-brand" href="/">
          TOUCHTOSTEER<span>SPECTRAL CONTROL SYSTEM</span>
        </a>
        <nav aria-label="Main">
          <a href="/setup">PC setup</a>
          <a href="/controller">Open controller ↗</a>
        </nav>
      </header>
      <div className="docs-grid">
        <aside className="docs-sidebar">
          <p className="docs-eyebrow">HELP / INFORMATION</p>
          <nav aria-label="Documentation">
            {docNavigation.map((item) => (
              <a
                key={item.id}
                href={`/${item.id}`}
                aria-current={item.id === pageId ? "page" : undefined}
              >
                {item.title}
              </a>
            ))}
          </nav>
          <a className="docs-support-link" href={SUPPORT_URL}>
            Support on GitHub ↗
          </a>
        </aside>
        <main id="doc-content" className="docs-content">
          <p className="docs-eyebrow">TOUCHTOSTEER / DOCUMENTATION</p>
          <h1>{page.title}</h1>
          <p className="docs-intro">{page.intro}</p>
          <nav className="docs-toc" aria-label="On this page">
            <strong>On this page</strong>
            <ul>
              {page.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ul>
          </nav>
          {page.sections.map((section) => (
            <section key={section.id} id={section.id} className="docs-section">
              <h2>{section.title}</h2>
              {section.paragraphs?.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {section.steps && (
                <ol>
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
              {section.items && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {section.table && (
                <div
                  className="docs-table-scroll"
                  role="region"
                  aria-label={section.title}
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        {section.table.headers.map((h) => (
                          <th key={h} scope="col">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {section.links && (
                <div className="docs-section-links">
                  {section.links.map((link) => (
                    <a key={link.href} href={link.href}>
                      {link.label}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                  ))}
                </div>
              )}
            </section>
          ))}
          <footer className="docs-contact">
            <h2>Need help?</h2>
            <p>Contact the project maintainers through GitHub Issues.</p>
            <a href={SUPPORT_URL}>github.com/arivuwallet-sketch/touch-to-steer/issues</a>
            <p>Public support channel. Keep pairing keys and personal information private.</p>
          </footer>
        </main>
      </div>
      <footer className="docs-footer">
        <a href="/">TOUCHTOSTEER</a>
        <DocumentationLinks />
      </footer>
    </div>
  );
}
