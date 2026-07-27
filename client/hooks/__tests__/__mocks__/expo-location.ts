// Minimal stub — only constants used by useVehicleSpeed are needed.
export enum Accuracy {
  Lowest = 1,
  Low = 2,
  Balanced = 3,
  High = 4,
  Highest = 5,
  BestForNavigation = 6,
}
export const requestForegroundPermissionsAsync = async () => ({ status: "granted" });
export const watchPositionAsync = async () => ({ remove: () => {} });
