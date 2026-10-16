import json
from pathlib import Path
p=Path('docs/diagrams/src/diagrams.json')
a=json.loads(p.read_text(encoding='utf-8'))
# Keep shared source but assign unique draw.io output names for repeated kinds.
for i,x in enumerate(a):
    if x['kind']=='usecase': x['file']=f'usecase-pn{i}'
    elif x['kind']=='sequence': x['file']=f"sequence-cu-{i-7:02d}"
# States are already in documented schema in the stored spec; assign unique names.
for i,x in enumerate((y for y in a if y['kind']=='state')):
    x['file']=('state-expected-payment','state-connection','state-webhook')[i]
# Architecture and deployment use groups/nodes/links schema.
x=next(y for y in a if y['kind']=='architecture')
x.clear(); x.update({'kind':'architecture','file':'architecture','title':'Arquitectura lógica actual','groups':[{'name':'Web client','nodes':[{'id':'browser','name':'Next.js App Router / PWA','type':'device'},{'id':'ui','name':'Dashboard / Caja / Reportes','type':'component'}]},{'name':'Vercel','nodes':[{'id':'api','name':'Server/API Routes + proxy','type':'component'},{'id':'worker','name':'Webhook worker / Cron','type':'component'}]},{'name':'Supabase','nodes':[{'id':'auth','name':'Supabase Auth','type':'component'},{'id':'db','name':'PostgreSQL + RLS','type':'database'}]},{'name':'Proveedores','nodes':[{'id':'mp','name':'Mercado Pago API/Webhook','type':'external'},{'id':'uala','name':'Ualá Bis API/Callback','type':'external'}]},{'name':'Push','nodes':[{'id':'push','name':'Web Push','type':'external'}]}],'links':[['browser','ui','render'],['ui','api','HTTPS'],['api','auth','session'],['api','db','TLS'],['api','mp','OAuth/fetch'],['mp','api','webhook HTTPS'],['api','uala','fetch order'],['uala','api','callback'],['worker','db','claim/ingest'],['worker','push','push']]})
x=next(y for y in a if y['kind']=='deployment')
x.clear(); x.update({'kind':'deployment','file':'deployment','title':'Despliegue [Inferido] — validar staging','groups':[{'name':'Cliente','nodes':[{'id':'browser','name':'Browser','type':'user'}]},{'name':'Vercel','nodes':[{'id':'app','name':'Next.js App/API','type':'component'},{'id':'cron','name':'Cron worker','type':'component'}]},{'name':'Supabase','nodes':[{'id':'auth','name':'Auth','type':'component'},{'id':'db','name':'PostgreSQL/RLS','type':'database'}]},{'name':'Terceros','nodes':[{'id':'mp','name':'Mercado Pago','type':'external'},{'id':'uala','name':'Ualá Bis','type':'external'},{'id':'push','name':'Web Push','type':'external'}]}],'links':[['browser','app','HTTPS'],['app','auth','API'],['app','db','TLS'],['cron','app','Bearer CRON_SECRET'],['mp','app','webhook'],['uala','app','callback'],['app','mp','OAuth/fetch'],['app','uala','fetch order'],['app','push','push']]})
x=next(y for y in a if y['kind']=='activity' and y.get('title')=='Flujo de pantallas')
x['file']='screen-flow'
p.write_text(json.dumps(a,ensure_ascii=False),encoding='utf-8')
