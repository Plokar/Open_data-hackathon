import Header from '../components/Header';
import { useAuth } from '../lib/AuthContext';

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Načítání...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Next.js + Django Template
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Moderní full-stack šablona s autentizací a REST API
          </p>
          
          {isAuthenticated ? (
            <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Vítejte, {user?.first_name || user?.username}!
              </h2>
              <p className="text-gray-600 mb-4">
                Jste úspěšně přihlášeni
              </p>
              <div className="text-left bg-gray-50 rounded-md p-4">
                <p className="text-sm text-gray-600">
                  <strong>Username:</strong> {user?.username}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Email:</strong> {user?.email}
                </p>
                {user?.first_name && (
                  <p className="text-sm text-gray-600">
                    <strong>Jméno:</strong> {user?.first_name} {user?.last_name}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-blue-800 mb-4">
                Pro přístup k plným funkcím se přihlaste nebo zaregistrujte
              </p>
            </div>
          )}
        </div>

        {/* Features Section */}
        <div id="features" className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Rychlý Start
            </h3>
            <p className="text-gray-600">
              Kompletní nastavení s Dockerem, PostgreSQL a připraveným autentizačním systémem
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl mb-4">🔐</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Autentizace
            </h3>
            <p className="text-gray-600">
              Produkční řešení s Django session autentizací, registrací a správou uživatelů
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Moderní Stack
            </h3>
            <p className="text-gray-600">
              Next.js 13, Django 4.2, TailwindCSS, PostgreSQL a REST Framework
            </p>
          </div>
        </div>

        {/* API Info Section */}
        <div id="about" className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            API Endpoints
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-start">
              <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono mr-3">
                GET
              </span>
              <code className="text-gray-800">/api/</code>
              <span className="text-gray-600 ml-auto">Root API endpoint</span>
            </div>
            <div className="flex items-start">
              <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded font-mono mr-3">
                POST
              </span>
              <code className="text-gray-800">/api/auth/login/</code>
              <span className="text-gray-600 ml-auto">Přihlášení</span>
            </div>
            <div className="flex items-start">
              <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded font-mono mr-3">
                POST
              </span>
              <code className="text-gray-800">/api/auth/register/</code>
              <span className="text-gray-600 ml-auto">Registrace</span>
            </div>
            <div className="flex items-start">
              <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded font-mono mr-3">
                POST
              </span>
              <code className="text-gray-800">/api/auth/logout/</code>
              <span className="text-gray-600 ml-auto">Odhlášení</span>
            </div>
            <div className="flex items-start">
              <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono mr-3">
                GET
              </span>
              <code className="text-gray-800">/api/auth/profile/</code>
              <span className="text-gray-600 ml-auto">Uživatelský profil</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-600 text-sm">
            © 2025 Web Template. Next.js + Django + PostgreSQL
          </p>
        </div>
      </footer>
    </div>
  );
}
