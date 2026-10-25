import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Condiciones del servicio | PayAlert',
  description: 'Condiciones de uso del servicio PayAlert para comercios.',
};

export default function TermsPage() {
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
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Condiciones del servicio</h1>
            <p className="text-sm text-slate-400">Vigentes desde el 25/10/2026</p>
          </header>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">Qué ofrece PayAlert</h2>
            <p className="leading-7 text-slate-300">PayAlert es un servicio para avisar y registrar los cobros recibidos por Mercado Pago en tu comercio. Al usarlo, entendés que las notificaciones son una ayuda para el seguimiento de la actividad y no reemplazan la consulta de tu cuenta.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">Cuenta y conexión</h2>
            <p className="leading-7 text-slate-300">La cuenta puede identificarse con Google o con un email. El acceso con Google se usa solo para identificarte con el email y el nombre; no accedemos a Gmail ni a tus contactos. La conexión a Mercado Pago requiere un token, que PayAlert almacena cifrado para prestar el servicio.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">Cobros y confirmación</h2>
            <p className="leading-7 text-slate-300">PayAlert no es una entidad financiera y no procesa, recibe ni custodia dinero. El dinero de cada cobro va directamente a la cuenta de Mercado Pago del comercio. Los avisos que llegan al celular son una pista y pueden demorarse o no estar disponibles; la confirmación válida del pago es la que figura en Mercado Pago.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">Disponibilidad</h2>
            <p className="leading-7 text-slate-300">El servicio depende de sistemas y redes propios y de terceros. No garantizamos disponibilidad ininterrumpida ni que cada aviso llegue en tiempo real o sin errores. No uses una notificación de PayAlert como único comprobante para entregar productos o prestar servicios.</p>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-100">Datos personales y baja</h2>
            <p className="leading-7 text-slate-300">El tratamiento de datos se explica en nuestra <Link href="/privacidad" className="font-semibold text-blue-400 underline decoration-blue-400/50 underline-offset-4 hover:text-blue-300">Política de privacidad</Link>. Para solicitar la baja y el borrado de tus datos, escribinos a <a className="break-all font-semibold text-blue-400 underline decoration-blue-400/50 underline-offset-4 hover:text-blue-300" href="mailto:tecnofusion.it@gmail.com">tecnofusion.it@gmail.com</a>.</p>
          </section>
          <p className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm leading-6 text-slate-400">Texto general, no es asesoramiento legal.</p>
          <nav aria-label="Páginas legales" className="flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-800 pt-6 text-sm font-semibold">
            <Link href="/privacidad" className="text-blue-400 underline decoration-blue-400/40 underline-offset-4 hover:text-blue-300">Política de privacidad</Link>
            <Link href="/" className="text-slate-300 underline decoration-slate-500 underline-offset-4 hover:text-white">Volver al inicio</Link>
          </nav>
        </div>
      </article>
    </main>
  );
}
