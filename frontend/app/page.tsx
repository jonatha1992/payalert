import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center items-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="bg-blue-100 p-4 rounded-full">
            <ShieldCheck className="w-16 h-16 text-blue-600" />
          </div>
        </div>

        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          PayAlert SaaS
        </h1>

        <p className="text-lg text-gray-600 dark:text-gray-400">
          La plataforma definitiva para gestionar los pagos de tu negocio y configurar tu tienda.
        </p>

        <div className="space-y-4 pt-4">
          <Link
            href="/login"
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-xl"
          >
            <span>Iniciar Sesión</span>
            <ArrowRight size={20} />
          </Link>

          <Link
            href="/admin"
            className="block text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Ir directamente al Panel (si ya ingresaste)
          </Link>
        </div>
      </div>

      <div className="mt-16 text-center text-sm text-gray-400">
        &copy; {new Date().getFullYear()} PayAlert. Todos los derechos reservados.
      </div>
    </div>
  );
}
