import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return React.createElement('pre', {
        style: { color: 'red', padding: 20, fontFamily: 'monospace', fontSize: 14, background: '#0a0a0a' }
      }, 'Render error: ' + this.state.error.message + '\n' + this.state.error.stack);
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root'));
root.render(
  React.createElement(ErrorBoundary, null, React.createElement(App))
);
