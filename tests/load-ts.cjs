// Execute the real TypeScript/React modules in Node tests, including @ aliases.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function loadTS(file) {
  file = path.resolve(root, file);
  if (!path.extname(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
  if (cache.has(file)) return cache.get(file).exports;
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  cache.set(file, module);
  const resolve = spec => {
    if (spec.startsWith('@/')) return loadTS(path.join(root, 'src', spec.slice(2)));
    if (spec.startsWith('.')) return loadTS(path.resolve(path.dirname(file), spec));
    return require(spec);
  };
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: file })(resolve,module,module.exports);
  return module.exports;
}
module.exports = { loadTS };
