// Conector de datáfono (pago con tarjeta).
//
// La solución que SIEMPRE funciona, sin integrarse con nada, es la "pantalla
// de cobro": mostrar el monto exacto en letra gigante para que el cliente lo
// vea y el cajero lo digite (o el cliente lo verifique) en cualquier
// datáfono físico, de cualquier marca, sin configurar nada — eso vive
// enteramente en el frontend (ver PantallaCobro en el POS).
//
// Lo que sí requiere integración real es "empujar" el cobro automáticamente
// al datáfono para que se active solo. Cada marca de datáfono en Colombia
// (Bold, RappiPay POS, Movii, addi, datáfonos de bancos) tiene su propia API
/// SDK y requiere una cuenta de comercio habilitada — no hay un estándar
// universal. Aquí se deja un conector de referencia para Bold (uno de los
// más usados por pequeños comercios en Colombia) siguiendo su contrato
// público de API; antes de usarlo en producción, verifica el contrato
// vigente en https://developers.bold.co porque las APIs de pagos cambian.

import type { Configuracion } from "@prisma/client";

export interface ResultadoCobroTerminal {
  ok: boolean;
  mensaje: string;
  idTransaccion?: string;
}

export interface TerminalProvider {
  nombre: string;
  cobrar(monto: number, referencia: string, config: Configuracion): Promise<ResultadoCobroTerminal>;
}

export class SinTerminalProvider implements TerminalProvider {
  nombre = "NINGUNO";

  async cobrar(): Promise<ResultadoCobroTerminal> {
    return {
      ok: false,
      mensaje: "No hay un datáfono conectado automáticamente. Usa la pantalla de cobro y digita el monto en el datáfono.",
    };
  }
}

export class BoldTerminalProvider implements TerminalProvider {
  nombre = "BOLD";

  async cobrar(monto: number, referencia: string, config: Configuracion): Promise<ResultadoCobroTerminal> {
    if (!config.datafonoApiUrl || !config.datafonoApiKey) {
      throw new Error("Faltan credenciales del datáfono en Configuración");
    }

    const resp = await fetch(`${config.datafonoApiUrl}/payment-intents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `x-api-key ${config.datafonoApiKey}`,
      },
      body: JSON.stringify({
        amount: { currency: "COP", total_amount: Math.round(monto * 100) },
        reference: referencia,
      }),
    });

    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      throw new Error(`El datáfono rechazó la solicitud (HTTP ${resp.status}): ${texto}`);
    }

    const data = (await resp.json()) as { payment_id?: string };
    return {
      ok: true,
      mensaje: "Cobro enviado al datáfono. Espera a que el cliente pague en el dispositivo.",
      idTransaccion: data.payment_id,
    };
  }
}

export function getTerminalProvider(config: Configuracion): TerminalProvider {
  if (config.proveedorDatafono === "BOLD") return new BoldTerminalProvider();
  return new SinTerminalProvider();
}
