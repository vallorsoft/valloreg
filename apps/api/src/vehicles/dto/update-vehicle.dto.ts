import { CreateVehicleDto } from './create-vehicle.dto';

/**
 * Jármű módosítása. Minden mező opcionális (a CreateVehicleDto-ból örökölve);
 * a megadott mezők frissülnek, a `parties` megadva felülírja a feleket.
 */
export class UpdateVehicleDto extends CreateVehicleDto {}
