import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('AI Dance Trainer captured unexpected UI exception:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#040712',
          color: '#f1f5f9',
          fontFamily: 'Inter, sans-serif',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            background: 'linear-gradient(135deg, rgba(20, 26, 46, 0.98), rgba(12, 16, 30, 0.98))',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            borderRadius: '20px',
            padding: '2.5rem 2rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.8rem 0', color: '#fff' }}>
              Unexpected Display Event
            </h2>
            <p style={{ fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 1.8rem 0' }}>
              A temporary display glitch occurred. Click below to reload the session.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: '0.85rem 2rem',
                background: 'linear-gradient(135deg, #00f0ff, #0072ff)',
                color: '#040712',
                fontWeight: 800,
                fontSize: '0.95rem',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0, 240, 255, 0.4)',
              }}
            >
              Reload Session
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
