const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Logo lab script is valid JavaScript', () => {
  const html = fs.readFileSync(path.join(__dirname, '../logo-lab/index.html'), 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'Should find a script tag in logo-lab/index.html');
  
  const scriptContent = scriptMatch[1];
  
  // Create a dummy environment to evaluate the script
  const sandbox = {
    document: {
      getElementById: () => ({
        appendChild: () => {}
      }),
      createElement: () => ({
        appendChild: () => {}
      })
    }
  };
  
  // This will throw a SyntaxError if the script is invalid
  const script = new vm.Script(scriptContent);
  
  // Evaluate to ensure it runs without runtime errors in our dummy environment
  script.runInNewContext(sandbox);
});