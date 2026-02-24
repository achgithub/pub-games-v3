/**
 * Rule: no-hardcoded-colors
 * Warns against hardcoded hex/rgb colors in inline styles
 * Suggests using Activity Hub classes instead
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Discourage hardcoded colors in favor of Activity Hub classes',
      category: 'Styling',
      recommended: true,
    },
    messages: {
      hardcodedColor: 'Avoid hardcoded colors ({{color}}). Use Activity Hub classes (.ah-btn-primary, .ah-card, etc.) instead.',
    },
    schema: [],
  },

  create(context) {
    // Regex patterns for color values
    const hexColorRegex = /#[0-9a-fA-F]{3,8}/;
    const rgbColorRegex = /rgba?\s*\(/;

    function checkForColors(node) {
      if (node.type === 'Literal' && typeof node.value === 'string') {
        const value = node.value;

        // Check for hex colors
        if (hexColorRegex.test(value)) {
          const match = value.match(hexColorRegex);
          context.report({
            node,
            messageId: 'hardcodedColor',
            data: {
              color: match[0],
            },
          });
        }

        // Check for rgb/rgba colors
        if (rgbColorRegex.test(value)) {
          context.report({
            node,
            messageId: 'hardcodedColor',
            data: {
              color: 'rgb/rgba',
            },
          });
        }
      }

      // Check template literals
      if (node.type === 'TemplateLiteral') {
        const text = node.quasis.map(q => q.value.cooked).join('');
        if (hexColorRegex.test(text) || rgbColorRegex.test(text)) {
          const match = text.match(hexColorRegex) || text.match(rgbColorRegex);
          context.report({
            node,
            messageId: 'hardcodedColor',
            data: {
              color: match ? match[0] : 'color value',
            },
          });
        }
      }
    }

    return {
      // Check JSX style attributes
      JSXAttribute(node) {
        if (node.name.name === 'style' && node.value) {
          if (node.value.type === 'JSXExpressionContainer') {
            const expression = node.value.expression;
            if (expression.type === 'ObjectExpression') {
              expression.properties.forEach(prop => {
                if (prop.value) {
                  checkForColors(prop.value);
                }
              });
            }
          }
        }
      },

      // Check variable declarations with color objects
      VariableDeclarator(node) {
        if (node.init && node.init.type === 'ObjectExpression') {
          node.init.properties.forEach(prop => {
            if (prop.value) {
              checkForColors(prop.value);
            }
          });
        }
      },
    };
  },
};
