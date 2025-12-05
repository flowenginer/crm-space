import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(true);

  // DEBUG: Log every render
  console.log('[DEBUG] ⚠️ NotFound RENDER', {
    timestamp: new Date().toISOString(),
    pathname: location.pathname,
    search: location.search,
    fullUrl: window.location.href
  });

  useEffect(() => {
    // Check if the URL has encoded query params in the path (common issue)
    const decodedPath = decodeURIComponent(location.pathname);
    
    console.log('[DEBUG] 🔍 NotFound useEffect', {
      pathname: location.pathname,
      decodedPath,
      hasEncodedQuery: decodedPath.includes('?'),
      isDifferent: decodedPath !== location.pathname
    });
    
    // If the path contains a ? after decoding, it means the URL was incorrectly encoded
    if (decodedPath.includes('?') && decodedPath !== location.pathname) {
      console.log("[DEBUG] 🔄 Redirecting malformed URL:", location.pathname, "->", decodedPath);
      navigate(decodedPath, { replace: true });
      return;
    }
    
    // Not a malformed URL, show 404
    setIsRedirecting(false);
    console.error("[DEBUG] ❌ 404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname, navigate]);

  // Don't render anything while checking/redirecting
  if (isRedirecting) {
    console.log('[DEBUG] ⏳ NotFound: Still redirecting, rendering null');
    return null;
  }

  console.log('[DEBUG] 📄 NotFound: Rendering 404 page');
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Página não encontrada</p>
        <Link to="/" className="text-primary underline hover:text-primary/90">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;