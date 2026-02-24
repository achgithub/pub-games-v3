/**
 * Rule: prefer-ah-classes
 * Detects common inline style patterns and suggests Activity Hub classes
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer Activity Hub classes over inline styles',
      category: 'Styling',
      recommended: true,
    },
    messages: {
      preferClass: 'Consider using Activity Hub class "{{className}}" instead of inline styles for {{property}}.',
    },
    schema: [],
  },

  create(context) {
    // Map of style properties to suggested classes
    const styleToClassMap = [
      {
        properties: ['padding', 'margin', 'maxWidth'],
        suggestedClass: '.ah-container / .ah-container--narrow / .ah-container--wide',
        matchPattern: (props) => props.includes('padding') || props.includes('maxWidth'),
      },
      {
        properties: ['background', 'padding', 'borderRadius'],
        suggestedClass: '.ah-card',
        matchPattern: (props) => props.includes('background') && props.includes('padding') && props.includes('borderRadius'),
      },
      {
        properties: ['background', 'color', 'padding', 'border'],
        suggestedClass: '.ah-btn-primary / .ah-btn-outline / .ah-btn-danger',
        matchPattern: (props) => (props.includes('background') || props.includes('border')) && props.includes('padding'),
      },
      {
        properties: ['display', 'gap', 'borderBottom'],
        suggestedClass: '.ah-tabs / .ah-tab',
        matchPattern: (props) => props.includes('borderBottom') || (props.includes('display') && props.includes('gap')),
      },
      {
        properties: ['display', 'gridTemplateColumns'],
        suggestedClass: '.ah-game-board / .ah-game-board--3x3 / .ah-game-board--dots',
        matchPattern: (props) => props.includes('gridTemplateColumns'),
      },
    ];

    function checkStyleObject(node) {
      if (node.type !== 'ObjectExpression') return;

      const properties = node.properties
        .map(prop => {
          if (prop.key && prop.key.name) return prop.key.name;
          if (prop.key && prop.key.value) return prop.key.value;
          return null;
        })
        .filter(Boolean);

      // Check against patterns
      styleToClassMap.forEach(({ matchPattern, suggestedClass, properties: patternProps }) => {
        if (matchPattern(properties)) {
          context.report({
            node,
            messageId: 'preferClass',
            data: {
              className: suggestedClass,
              property: patternProps.join(', '),
            },
          });
        }
      });
    }

    return {
      // Check JSX style attributes
      JSXAttribute(node) {
        if (node.name.name === 'style' && node.value) {
          if (node.value.type === 'JSXExpressionContainer') {
            const expression = node.value.expression;
            checkStyleObject(expression);
          }
        }
      },

      // Check style object variable declarations
      VariableDeclarator(node) {
        if (node.id && node.id.name && /style|Style|styles|Styles/.test(node.id.name)) {
          if (node.init) {
            checkStyleObject(node.init);
          }
        }
      },
    };
  },
};
