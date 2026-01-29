import Constants from 'expo-constants';

export type AppVariant = 'rider' | 'driver' | 'unified';

function getAppVariant(): AppVariant {
  const variant = Constants.expoConfig?.extra?.appVariant;
  
  if (variant === 'rider') return 'rider';
  if (variant === 'driver') return 'driver';
  
  return 'unified';
}

export const APP_VARIANT = getAppVariant();

export const isRiderApp = APP_VARIANT === 'rider' || APP_VARIANT === 'unified';
export const isDriverApp = APP_VARIANT === 'driver' || APP_VARIANT === 'unified';

export function getAppDisplayName(): string {
  switch (APP_VARIANT) {
    case 'rider':
      return 'Travony';
    case 'driver':
      return 'Travony Driver';
    default:
      return 'Travony';
  }
}
