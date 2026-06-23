import { IsIn } from 'class-validator';

/**
 * Duplikátum feloldása. A spec szerint a duplikátum NEM tartható meg
 * párhuzamosan: az egyetlen művelet a `overwrite` (az új felülírja az eredetit).
 * A "megtartás" szándékosan kimaradt; a duplikátum a sima törléssel dobható el.
 */
export class ResolveDuplicateDto {
  @IsIn(['overwrite'])
  action!: 'overwrite';
}
