import type { OhlcData } from "lightweight-charts";

export type PositionType = "BUY" | "SELL";

export type OrderType =
  | "BUY_MARKET"
  | "SELL_MARKET"
  | "BUY_LIMIT"
  | "SELL_LIMIT";

export interface ICandle extends OhlcData {}

interface BaseOrder {
  id: string;
  price: number;
  amount: number;
  sl: number;
  tp: number;
}

export interface IOrder extends BaseOrder {
  type: OrderType;
}

export interface IPosition extends BaseOrder {
  type: PositionType;
}
