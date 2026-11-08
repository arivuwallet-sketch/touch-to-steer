const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { JSDOM } = require("jsdom");
const { loadTS } = require("./load-ts.cjs");
const { documentation, docNavigation, SUPPORT_URL } = loadTS("src/lib/documentation.ts");
const { DocumentationPage } = loadTS("src/components/docs/DocumentationPage.tsx");
const { DocumentationLinks } = loadTS("src/components/docs/DocumentationLinks.tsx");
for (const { id, title } of docNavigation)
  test(`${title}: accessible rendered page and resolvable local links`, () => {
    const doc = new JSDOM(
      renderToStaticMarkup(React.createElement(DocumentationPage, { pageId: id })),
    ).window.document;
    assert.equal(doc.querySelectorAll("h1").length, 1);
    assert.equal(doc.querySelector("h1").textContent, documentation[id].title);
    assert.ok(doc.querySelector(`a[aria-current="page"][href="/${id}"]`));
    assert.ok(
      [...doc.querySelectorAll("a")].some(
        (a) => a.href === SUPPORT_URL && a.textContent.includes("github.com"),
      ),
    );
    const ids = [...doc.querySelectorAll("[id]")].map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const anchor of doc.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href");
      if (href.startsWith("#")) assert.ok(doc.getElementById(href.slice(1)), href);
      else if (href.startsWith("/")) {
        const pathname = href.split("#")[0].split("?")[0];
        assert.ok(
          pathname === "/" ||
            fs.existsSync(`src/routes${pathname}.tsx`) ||
            fs.existsSync(`public${pathname}`),
          href,
        );
      } else assert.equal(new URL(href).protocol, "https:");
    }
    for (const table of doc.querySelectorAll("table")) {
      const columns = table.querySelectorAll("th").length;
      for (const row of table.querySelectorAll("tbody tr"))
        assert.equal(row.children.length, columns);
    }
    assert.ok(fs.readFileSync(`src/routes/${id}.tsx`, "utf8").includes(`/${id}`));
  });
test("Settings help keeps the active controller open in its original tab", () => {
  const doc = new JSDOM(
    renderToStaticMarkup(React.createElement(DocumentationLinks, { newTab: true })),
  ).window.document;
  assert.equal(doc.querySelectorAll("a").length, 7);
  for (const a of doc.querySelectorAll("a")) {
    assert.equal(a.target, "_blank");
    assert.ok(a.rel.includes("noopener"));
  }
});
