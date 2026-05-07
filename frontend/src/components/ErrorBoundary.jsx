import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FEE2E2',
              borderRadius: '8px',
              padding: '24px 32px',
              maxWidth: '480px',
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚠️</div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#DC2626',
                marginBottom: '8px',
              }}
            >
              Something went wrong
            </div>
            <div
              style={{
                fontSize: '13px',
                color: '#6B7280',
                marginBottom: '16px',
              }}
            >
              {this.state.error?.message ||
                'An unexpected error occurred in this tab.'}
            </div>
            <button
              className="primary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
