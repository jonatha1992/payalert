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
            La solución definitiva para que tus negocios reciban notificaciones de pagos instantáneas de Mercado Pago y Ualá.
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
            { title: 'Pago Seguro', desc: 'Integración certificada con las principales pasarelas de pago.', icon: Zap }
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
      </div>

      <p className="absolute bottom-8 text-slate-600 text-[10px] sm:text-xs font-medium uppercase tracking-[0.2em]">
        © 2026 PayAlert Systems | Advanced Agentic Coding
      </p>
    </main>
  );
}
