import { useSyncExternalStore } from "react";

const sinCambios = () => () => {};

// `false` en el servidor y durante la hidratación, `true` después. Sirve para
// pintar primero lo que funciona sin JavaScript y cambiarlo al hidratar sin
// que React lo tome por un desajuste entre servidor y cliente.
export function useHidratado(): boolean {
  return useSyncExternalStore(
    sinCambios,
    () => true,
    () => false
  );
}
