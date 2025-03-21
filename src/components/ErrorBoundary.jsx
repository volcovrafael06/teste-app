import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Atualiza o state para que a próxima renderização mostre a UI alternativa
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Podemos também registrar o erro em um serviço de relatórios de erros
    console.error("Erro capturado pelo boundary:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Você pode renderizar qualquer UI alternativa
      return (
        <div className="error-boundary-container">
          <h2>Algo deu errado.</h2>
          <details style={{ whiteSpace: 'pre-wrap', margin: '10px 0', padding: '10px', backgroundColor: '#f8f8f8', borderRadius: '5px' }}>
            <summary>Detalhes do erro</summary>
            <p>{this.state.error && this.state.error.toString()}</p>
            <p>Componente: {this.state.errorInfo && this.state.errorInfo.componentStack}</p>
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Recarregar página
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
