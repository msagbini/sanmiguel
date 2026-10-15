import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lector de código de barras USB tipo "pistola": el dispositivo se comporta
 * como un teclado que escribe muy rápido y termina con Enter. La forma más
 * confiable de capturarlo (sin depender de drivers ni de detectar velocidad
 * de tecleo) es mantener el foco fijado en un input dedicado: el hook expone
 * ese input, lo mantiene enfocado todo el tiempo que la pantalla esté activa,
 * y dispara onScan(codigo) cuando llega un Enter.
 */
export function useBarcodeScanner(onScan: (codigo: string) => void, enabled = true) {
  const [valor, setValor] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const enfocar = useCallback(() => {
    if (enabled) inputRef.current?.focus();
  }, [enabled]);

  useEffect(() => {
    enfocar();
  }, [enfocar]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const codigo = valor.trim();
      if (codigo) onScan(codigo);
      setValor("");
    }
  }

  function onBlur(e: React.FocusEvent<HTMLInputElement>) {
    // Si el foco se va a otro campo de formulario (un modal, un buscador),
    // lo respetamos. Si se va "a la nada" (click en el fondo), recuperamos
    // el foco para que la pistola siga funcionando sin que el cajero tenga
    // que hacer clic de nuevo en el campo.
    const destino = e.relatedTarget as HTMLElement | null;
    const esCampoInteractivo = destino && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(destino.tagName);
    if (!esCampoInteractivo) {
      setTimeout(enfocar, 0);
    }
  }

  return {
    inputRef,
    enfocar,
    inputProps: {
      ref: inputRef,
      value: valor,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValor(e.target.value),
      onKeyDown,
      onBlur,
    },
  };
}
