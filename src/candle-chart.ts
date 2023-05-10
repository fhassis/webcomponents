import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ref, Ref, createRef } from "lit/directives/ref.js";

import {
	createChart,
	CrosshairMode,
	LineStyle,
	TrackingModeExitMode,
} from "lightweight-charts";
import type {
	IChartApi,
	MouseEventParams,
	PriceLineOptions,
	Point,
	IPriceLine,
	ISeriesApi,
} from "lightweight-charts";
import type { ICandle, IOrder } from "./typings";

@customElement("candle-chart")
export class CandleChart extends LitElement {
	@property()
	precision = 0.00001;

	chartDivRef: Ref<HTMLElement> = createRef();

	orders: IOrder[] = [];
	chart: IChartApi | null = null;
	candleSeries: ISeriesApi<"Candlestick"> | null = null;
	priceLines: Map<String, IPriceLine> = new Map();
	clickThreshold = 0.0003;
	selectedLine: IPriceLine | null = null;
	offset: number | null = null;

	firstUpdated() {
		// // gets a reference of the chart div element
		const chartDiv = this.chartDivRef.value!;

		// initialize the chart
		this.chart = createChart(chartDiv, {
			localization: { locale: "en-US" }, // standardize locale (do not use from the browser)
			crosshair: { mode: CrosshairMode.Normal },
			timeScale: { rightOffset: 2, rightBarStaysOnScroll: true },
			trackingMode: { exitMode: TrackingModeExitMode.OnNextTap },
		});

		// redraw the chart when rotating the phone
		window.addEventListener("orientationchange", () => {
			this.chart!.resize(chartDiv.offsetHeight, chartDiv.offsetWidth);
		});

		// initialize the candlestick series
		this.candleSeries = this.chart.addCandlestickSeries({
			priceFormat: { type: "price", minMove: this.precision },
		});

		// handles clicks in chart
		this.chart.subscribeClick((param: MouseEventParams) => {
			// check if clicked inside a valid chart area
			if (param.point) {
				// check if a line was clicked
				const clickedLine = this.getClickedLine(param.point);

				// unselect a previously selected line
				if (this.selectedLine) {
					this.configPriceLine(this.selectedLine, false);
					this.offset = null;
				}

				// selects the new line (if there is one)
				if (clickedLine) {
					this.configPriceLine(clickedLine, true);
					this.dispatchEvent(
						new CustomEvent("line-clicked", {
							detail: clickedLine,
							bubbles: true,
							composed: true,
						})
					);
				}

				// saves the previous clicked line status (some line or null)
				this.selectedLine = clickedLine;

				// changes settings if a line is selected
				if (this.selectedLine) {
					this.configChart(true);
					this.chart!.subscribeCrosshairMove(
						this.crosshairMoveHandler
					);
				} else {
					this.configChart(false);
					this.chart!.unsubscribeCrosshairMove(
						this.crosshairMoveHandler
					);
				}
			}
		});
	}

	setCandles = (candles: ICandle[]) => {
		// pass candle data to the chart
		this.candleSeries!.setData(candles);
	};

	setOrders = (pOrders: IOrder[]) => {

		// creates new line objects for each order
		pOrders.forEach((order) => {

			const isBuy = order.type === "BUY_LIMIT";

			// creates the entry price line
			const lineId = `EN${order.id}`;
			this.priceLines.set(
				lineId, 
				this.candleSeries!.createPriceLine(
					this.createOrderLine(order.price, isBuy, lineId)
				)
			);

			// creates the SL price line
			if (order.sl !== 0.0) {
				const lineId = `SL${order.id}`;
				this.priceLines.set(
					lineId, 
					this.candleSeries!.createPriceLine(
						this.createOrderLine(order.sl, isBuy, lineId)
					)
				);
			}

			// creates the TP price line
			if (order.tp !== 0.0) {
				const lineId = `TP${order.id}`;
				this.priceLines.set(
					lineId,
					this.candleSeries!.createPriceLine(
						this.createOrderLine(order.tp, isBuy, lineId)
					)
				);
			}
		});
	};

	// creates a line options object according to order parameters
	createOrderLine = (price: number, isBuy: boolean, lineId: string): PriceLineOptions => {
		return {
			id: lineId,
			price: price,
			color: isBuy ? "blue" : "black",
			lineWidth: 1,
			lineStyle: LineStyle.LargeDashed,
			lineVisible: true,
			axisLabelVisible: false,
			title: lineId,
			axisLabelColor: "",
			axisLabelTextColor: "",
		};
	};

	// check if a click in the chart was over some line
	getClickedLine = (coord: Point): IPriceLine | null => {
		// calculate the price interval with a threshold
		const clickedPrice = this.candleSeries!.coordinateToPrice(coord.y)!;
		const minPrice = clickedPrice * (1 - this.clickThreshold);
		const maxPrice = clickedPrice * (1 + this.clickThreshold);

		// check the order lines
		for (const [_, priceLine] of this.priceLines.entries()) {
			const orderPrice = priceLine.options().price;
			if (orderPrice >= minPrice && orderPrice <= maxPrice) {
				return priceLine;
			}
		}

		// return null if no line was clicked
		return null;
	};

	// changes line attributes to create an effect of selected / unselected
	configPriceLine = (priceLine: IPriceLine, isSelected: boolean) => {
		let newOptions = { ...priceLine.options() };
		newOptions.axisLabelVisible = isSelected ? true : false;
		newOptions.lineWidth = isSelected ? 3 : 1;
		newOptions.lineStyle = isSelected
			? LineStyle.Dashed
			: LineStyle.LargeDashed;
		priceLine.applyOptions(newOptions);
	};

	// configures the chart differently if some line is selected
	configChart = (IsSomeLineSelected: boolean) => {
		this.chart!.applyOptions({
			crosshair: {
				horzLine: {
					visible: !IsSomeLineSelected,
					labelVisible: !IsSomeLineSelected,
				},
				vertLine: {
					visible: !IsSomeLineSelected,
					labelVisible: !IsSomeLineSelected,
				},
			},
		});
	};

	// drags a priceLine based on coordinates from crosshair movement
	crosshairMoveHandler = (params: MouseEventParams) => {
		// check if clicked inside valid chart area
		if (params.point) {
			if (this.selectedLine) {
				const draggedPrice = this.candleSeries!.coordinateToPrice(
					params.point.y
				)!;
				let newOptions = { ...this.selectedLine.options() };
				if (this.offset === null) {
					this.offset = newOptions.price - draggedPrice;
				}
				newOptions.price = draggedPrice + this.offset;
				this.selectedLine.applyOptions(newOptions);
			}
		}
	};

	render() {
		return html` <div id="chartDiv" ${ref(this.chartDivRef)}></div> `;
	}

	static styles = css`
		#chartDiv {
			width: 100%;
			height: 100%;
		}
	`;
}
