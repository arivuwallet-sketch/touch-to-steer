import { docNavigation } from "@/lib/documentation-navigation";
export function DocumentationLinks({ newTab = false }: { newTab?: boolean }) {
  return (
    <nav className="docs-links" aria-label="Help and information">
      {docNavigation.map((page) => (
        <a
          key={page.id}
          href={`/${page.id}`}
          target={newTab ? "_blank" : undefined}
          rel={newTab ? "noopener noreferrer" : undefined}
        >
          {page.title}
          {newTab && <span className="sr-only"> (opens in a new tab)</span>}
        </a>
      ))}
    </nav>
  );
}
