/**
 * Rule: require-shared-css
 * Ensures that index.tsx files dynamically load Activity Hub CSS from identity-shell
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require dynamic loading of Activity Hub CSS in index.tsx',
      category: 'Styling',
      recommended: true,
    },
    messages: {
      missingCssLoad: 'index.tsx must dynamically load Activity Hub CSS from identity-shell. Add:\n' +
        'const link = document.createElement(\'link\');\n' +
        'link.rel = \'stylesheet\';\n' +
        'link.href = `http://${window.location.hostname}:3001/shared/activity-hub.css`;\n' +
        'document.head.appendChild(link);',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Only check index.tsx files
    if (!filename.endsWith('index.tsx')) {
      return {};
    }

    let hasCreateElement = false;
    let hasActivityHubCss = false;
    let hasAppendChild = false;

    return {
      Program(node) {
        const sourceCode = context.getSourceCode();
        const text = sourceCode.getText(node);

        // Check for the required pattern
        hasCreateElement = text.includes('document.createElement(\'link\')') ||
                          text.includes('document.createElement("link")');
        hasActivityHubCss = text.includes('activity-hub.css');
        hasAppendChild = text.includes('document.head.appendChild');

        if (!hasCreateElement || !hasActivityHubCss || !hasAppendChild) {
          context.report({
            node,
            messageId: 'missingCssLoad',
          });
        }
      },
    };
  },
};
