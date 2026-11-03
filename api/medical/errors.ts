/** La base de datos rechazó un solapamiento, también en peticiones simultáneas. */
export class MedicalSlotConflictError extends Error {
  constructor() {
    super("El horario ya no está disponible.");
    this.name = "MedicalSlotConflictError";
  }
}
