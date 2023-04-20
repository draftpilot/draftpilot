import React from 'react';

const ContextEditor: React.FC = () => {
  const handleSave = () => {
    // Save logic here
  };

  return (
    <div>
      <h1>Project Context</h1>
      <textarea className="w-full h-64"></textarea>
      <button onClick={handleSave}>Save</button>
    </div>
  );
};

export default ContextEditor;