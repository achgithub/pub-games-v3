import React, { useState } from 'react';

interface Props {
  token: string;
}

function FormsSection({ token }: Props) {
  const [textValue, setTextValue] = useState('');
  const [selectValue, setSelectValue] = useState('option1');

  return (
    <>
      <div className="ah-card">
        <h2>Forms</h2>
        <p className="ah-meta">
          Form inputs, selects, and inline form patterns.
        </p>
      </div>

      {/* Text Input */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Text Input</span>
            <code className="component-class">.ah-input</code>
          </div>
          <p className="component-purpose">
            Standard text input with hover and focus states
          </p>
          <div className="component-preview">
            <label className="ah-label">
              Enter your name:
              <input
                type="text"
                className="ah-input"
                placeholder="Type here..."
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
              />
            </label>
          </div>
          <div className="component-code">
            <pre><code>{`<input
  type="text"
  className="ah-input"
  placeholder="Type here..."
/>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Select */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Select</span>
            <code className="component-class">.ah-select</code>
          </div>
          <p className="component-purpose">
            Dropdown select with consistent styling
          </p>
          <div className="component-preview">
            <label className="ah-label">
              Choose an option:
              <select
                className="ah-select"
                value={selectValue}
                onChange={(e) => setSelectValue(e.target.value)}
              >
                <option value="option1">Option 1</option>
                <option value="option2">Option 2</option>
                <option value="option3">Option 3</option>
              </select>
            </label>
          </div>
          <div className="component-code">
            <pre><code>{`<select className="ah-select">
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</select>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Label</span>
            <code className="component-class">.ah-label</code>
          </div>
          <p className="component-purpose">
            Form label with consistent spacing and styling
          </p>
          <div className="component-preview">
            <label className="ah-label">
              Field Label
              <input type="text" className="ah-input" placeholder="Input field" />
            </label>
          </div>
          <div className="component-code">
            <pre><code>{`<label className="ah-label">
  Field Label
  <input type="text" className="ah-input" />
</label>`}</code></pre>
          </div>
        </div>
      </div>

      {/* Inline Form */}
      <div className="component-section">
        <div className="component-demo">
          <div className="component-header">
            <span className="component-name">Inline Form</span>
            <code className="component-class">.ah-inline-form</code>
          </div>
          <p className="component-purpose">
            Horizontal form layout with input and button side by side
          </p>
          <div className="component-preview">
            <form className="ah-inline-form" onSubmit={(e) => e.preventDefault()}>
              <input
                type="text"
                className="ah-input"
                placeholder="Enter value..."
              />
              <button type="submit" className="ah-btn-primary">
                Submit
              </button>
            </form>
          </div>
          <div className="component-code">
            <pre><code>{`<form className="ah-inline-form">
  <input type="text" className="ah-input" />
  <button className="ah-btn-primary">
    Submit
  </button>
</form>`}</code></pre>
          </div>
        </div>
      </div>
    </>
  );
}

export default FormsSection;
