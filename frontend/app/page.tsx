import Link from 'next/link';
import { ShieldCheck, ArrowRight, Store, Zap } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="z-10 max-w-4xl text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="inline-flex items-center space-x-2 bg-blue-500/10 text-blue-400 px-4 py-2 rounded-full border border-blue-500/20 mb-4">
          <Zap size={16} />
          <span className="text-xs font-bold uppercase tracking-widest">Plataforma de Notificaciones en tiempo real</span>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-600 rounded-3xl shadow-2xl shadow-blue-600/20">
              <ShieldCheck size={64} className="text-white" />
            </div>
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">
            PayAlert
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
            La solución definitiva para que tus negocios reciban notificaciones de pagos instantáneas de Mercado Pago y Ualá Bis.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <Link href="/login" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black py-5 px-10 rounded-2xl transition-all shadow-xl shadow-blue-600/25 active:scale-95 flex items-center justify-center space-x-3 text-lg">
            <span>Comenzar ahora</span>
            <ArrowRight size={20} />
          </Link>
          <Link href="/admin" className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold py-5 px-10 rounded-2xl transition-all border border-slate-800 active:scale-95 flex items-center justify-center space-x-3 text-lg">
            <ShieldCheck size={20} />
            <span>Acceso Administrador</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 border-t border-slate-900">
          {[
            { title: 'Gestión Total', desc: 'Panel centralizado para administrar todos tus clientes y negocios.', icon: ShieldCheck },
            { title: 'Multisucursal', desc: 'Permite que tus clientes gestionen todas sus tiendas desde un solo lugar.', icon: Store },
            { title: 'Pagos Seguros', desc: 'Integración certificada con las principales pasarelas de pago.', icon: Zap }
          ].map((feat, i) => (
            <div key={i} className="text-left space-y-3">
              <div className="text-blue-500 bg-blue-500/10 w-10 h-10 rounded-lg flex items-center justify-center">
                <feat.icon size={20} />
              </div>
              <h3 className="font-bold text-slate-200">{feat.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>

        {/* Contact Section */}
        <div className="pt-12 mt-12 pb-20 border-t border-slate-900 w-full max-w-2xl mx-auto flex flex-col items-center">
          <h2 className="text-2xl font-bold text-slate-200 mb-4 text-center">¿Tenés dudas? Contactanos</h2>
          <p className="text-slate-400 text-center mb-6">Estamos para ayudarte a configurar tu negocio.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="mailto:soporte@payalert.com.ar" 
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 px-6 rounded-xl transition-all border border-slate-700 flex items-center justify-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <span>soporte@payalert.com.ar</span>
            </a>
            <a 
              href="https://wa.me/5491112345678?text=Hola!%20Quiero%20información%20sobre%20PayAlert" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-green-600/20 flex items-center justify-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 text-center">
        <p className="text-slate-600 text-[10px] sm:text-xs font-medium uppercase tracking-[0.2em]">
          © 2026 PayAlert Systems
        </p>
        <p className="text-slate-500 text-[10px] sm:text-xs mt-1">
          Desarrollado por{' '}
          <a 
            href="https://tecnofuision-it.web.app/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            TecnoFusion IT
          </a>
        </p>
      </div>
    </main>
  );
}
