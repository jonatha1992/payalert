import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de privacidad | PayAlert',
  description: 'Cómo PayAlert trata y protege los datos personales de sus usuarios.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 sm:py-12">
      <article className="mx-auto w-full max-w-3xl">
        <Link href="/" aria-label="PayAlert, ir al inicio" className="mb-8 inline-flex items-center gap-3 rounded-xl text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600"><ShieldCheck size={24} /></span>
          <span className="text-xl font-black tracking-tight">PayAlert</span>
        </Link>
        <div className="mt-8 space-y-8">
          <header className="space-y-3 border-b border-slate-800 pb-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">Información para usuarios</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Política de privacidad</h1>
            <p className="text-sm text-slate-400">Vigente desde el 25/10/2026</p>
          </header>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">Qué hace PayAlert</h2>
            <p className="leading-7 text-slate-300">PayAlert avisa y registra los cobros recibidos por tu comercio a través de Mercado Pago. El servicio no es una entidad financiera ni procesa dinero: los fondos se acreditan directamente en la cuenta de Mercado Pago del comercio.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">Datos que tratamos</h2>
            <ul className="list-disc space-y-2 pl-5 leading-7 text-slate-300">
              <li>El email y el nombre de la cuenta, ya sea de Google o de acceso por email, y el rol del usuario.</li>
              <li>Los movimientos de cobros: monto, hora, sucursal y los datos del pagador que informa Mercado Pago.</li>
              <li>El token de conexión a Mercado Pago, almacenado cifrado.</li>
              <li>Los dispositivos configurados para recibir avisos.</li>
            </ul>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">Inicio de sesión con Google</h2>
            <p className="leading-7 text-slate-300">Si elegís Google, lo usamos únicamente para identificarte mediante el email y el nombre de tu cuenta. PayAlert no accede a tu Gmail ni a tus contactos.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">Proveedores</h2>
            <p className="leading-7 text-slate-300">No vendemos tus datos ni los compartimos con terceros, salvo con Mercado Pago, Supabase y Vercel, que prestan servicios necesarios para la conexión de cobros, el almacenamiento y el funcionamiento de PayAlert.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">Avisos y confirmación de pagos</h2>
            <p className="leading-7 text-slate-300">Los avisos que recibís en el celular son una pista rápida y pueden demorarse o no llegar. Para confirmar un pago, consultá siempre la información oficial de Mercado Pago.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">Baja y borrado de datos</h2>
            <p className="leading-7 text-slate-300">Podés pedir la baja de tu cuenta y el borrado de tus datos escribiendo a <a className="break-all font-semibold text-blue-400 underline decoration-blue-400/50 underline-offset-4 hover:text-blue-300" href="mailto:tecnofusion.it@gmail.com">tecnofusion.it@gmail.com</a>.</p>
          </section>
          <p className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm leading-6 text-slate-400">Texto general, no es asesoramiento legal.</p>
          <nav aria-label="Páginas legales" className="flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-800 pt-6 text-sm font-semibold">
            <Link href="/terminos" className="text-blue-400 underline decoration-blue-400/40 underline-offset-4 hover:text-blue-300">Condiciones del servicio</Link>
            <Link href="/" className="text-slate-300 underline decoration-slate-500 underline-offset-4 hover:text-white">Volver al inicio</Link>
          </nav>
        </div>
      </article>
    </main>
  );
}
