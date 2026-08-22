import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import soap from 'node-soap';
import { createClient } from '@/lib/supabase/server';
import { buildSoapServiceObject } from '@/lib/services/StudyHubSoapService';

const wsdlPath = path.join(process.cwd(), 'public', 'studyhub.wsdl');

/**
 * El WSDL es un archivo estático que no cambia entre peticiones. Antes se leía
 * de disco y se reparseaba en cada POST; ahora se lee una vez por proceso.
 */
let cachedWsdl: string | null = null;

function getWsdl(): string {
  if (cachedWsdl === null) {
    cachedWsdl = fs.readFileSync(wsdlPath, 'utf-8');
  }
  return cachedWsdl;
}

const XML_HEADERS = { 'Content-Type': 'text/xml; charset=utf-8' } as const;

/** Escapa el texto que se interpola en el XML de respuesta. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function soapFault(message: string, code: 'Client' | 'Server', status: number): NextResponse {
  const fault = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:${code}</faultcode>
      <faultstring>${escapeXml(message)}</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
  return new NextResponse(fault, { status, headers: XML_HEADERS });
}

/**
 * GET /api/soap  →  devuelve el WSDL (para clientes que lo soliciten)
 */
export async function GET() {
  try {
    return new NextResponse(getWsdl(), { status: 200, headers: XML_HEADERS });
  } catch {
    return NextResponse.json({ error: 'WSDL no disponible' }, { status: 500 });
  }
}

/**
 * POST /api/soap  →  procesa un envelope SOAP 1.1
 *
 * Requiere sesión: el usuario se deriva de la cookie, no del envelope. El
 * `userId` que declara el WSDL se sigue aceptando por compatibilidad, pero
 * solo si coincide con la sesión (ver StudyHubSoapService).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return soapFault('No autorizado: se requiere una sesión válida.', 'Client', 401);
  }

  try {
    const body = await req.text();
    const wsdl = getWsdl();
    const serviceObject = buildSoapServiceObject(supabase, user.id);

    const responseXml = await new Promise<string>((resolve, reject) => {
      // node-soap está pensado para un servidor de larga vida, así que el
      // objeto de servicio se construye por petición: sus operaciones cierran
      // sobre el cliente de Supabase y el usuario de *esta* sesión, y no
      // pueden compartirse entre requests.
      soap.listen(
        { on: () => {} } as never,
        { path: '/api/soap', services: serviceObject, xml: wsdl },
        serviceObject,
        wsdl,
        (err: Error | null, server: soap.Server) => {
          if (err) { reject(err); return; }

          server.handleRequest(
            {
              method: 'POST',
              headers: Object.fromEntries(req.headers.entries()),
              body,
              url: '/api/soap',
            } as never,
            (xml: string) => resolve(xml),
            (e: Error) => reject(e),
          );
        },
      );
    });

    return new NextResponse(responseXml, { status: 200, headers: XML_HEADERS });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error inesperado.';
    // Los mensajes propios del servicio ("No autorizado…") describen la
    // operación y se devuelven; cualquier otro puede venir de Postgres o del
    // parser y describe el esquema, así que solo se registra.
    if (message.startsWith('No autorizado')) {
      return soapFault(message, 'Client', 403);
    }
    console.error('[soap] error procesando el envelope', e);
    return soapFault('No se pudo procesar la petición SOAP.', 'Server', 500);
  }
}
