const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ts=require('typescript');
const baseline=require('./layout-baseline.json');
for(const [file,expected] of Object.entries(baseline)) {
  test(`Layout unchanged: ${file}`,()=> {
    const source=ts.createSourceFile(file,fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const layout=[];
    function visit(node) {
      if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)) layout.push(`tag:${node.tagName.getText(source)}`);
      if(ts.isJsxAttribute(node)&&['className','style'].includes(node.name.getText(source))) layout.push(node.getText(source));
      ts.forEachChild(node,visit);
    }
    visit(source);
    assert.equal(crypto.createHash('sha256').update(JSON.stringify(layout)).digest('hex'),expected);
  });
}
