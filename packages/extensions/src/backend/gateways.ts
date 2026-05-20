function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/gateways must be resolved by the Neon Pilot host runtime.');
}

export const startTelegramGatewayService = (..._args: unknown[]): unknown => hostResolved();
export const stopTelegramGatewayService = (..._args: unknown[]): unknown => hostResolved();
export const readTelegramGatewayServiceStatus = (..._args: unknown[]): unknown => hostResolved();
