import { useRouteError } from "react-router-dom";

export default function ErrorPage() {
  const error = useRouteError();
  console.error(error);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      textAlign: 'center',
      padding: '20px',
      color: '#374151'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Oops!</h1>
      <p style={{ marginBottom: '1.5rem' }}>Sorry, an unexpected error has occurred.</p>
      <div style={{ 
        padding: '1rem', 
        background: '#fee2e2', 
        color: '#b91c1c', 
        borderRadius: '0.5rem',
        fontFamily: 'monospace'
      }}>
        <i>{(error as any).statusText || (error as any).message || 'Unknown Error'}</i>
      </div>
      <button 
        onClick={() => window.location.href = '/'} 
        style={{
          marginTop: '1.5rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#2563EB',
          color: 'white',
          border: 'none',
          borderRadius: '0.25rem',
          cursor: 'pointer'
        }}
      >
        Go to Home
      </button>
    </div>
  );
}
