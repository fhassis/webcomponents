import candlesDemo from "../test_data/Candles.json";
import ordersDemo from "../test_data/Orders.json";
import { CandleChart } from "./candle-chart";
import type { ICandle, IOrder } from "./typings";

// loads some demo data to test
const candles = candlesDemo as ICandle[];
const orders = ordersDemo as IOrder[];

// pass data to the web component
const candleChart: CandleChart = document.querySelector("candle-chart")!;
candleChart.setCandles(candles);
candleChart.setOrders(orders);

candleChart.addEventListener("line-clicked", (event) => {
    console.log(event.type, (<CustomEvent>event).detail);
});

candleChart.addEventListener("line-dragged", (event) => {
    console.log(event.type, (<CustomEvent>event).detail);
});
