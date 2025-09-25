import { OrderBookService } from '../orders/order-book.service';
import {
  OrderRequest,
  OrderSnapshot,
} from '../orders/order.types';
import { TradeRecorderService } from '../trading/trade-recorder.service';
import {
  ClosedTrade,
  OpenPosition,
  TradeFill,
  TradeSummary,
} from '../trading/trade.types';
import { MarketTick } from '../../shared/types/market';
import { OhlcvRecord, Timeframe } from '../../shared/types/ohlcv';

export type PlaceOrderInput = Omit<OrderRequest, 'symbol'> & { symbol?: string };

export interface StrategyContext {
  readonly symbol: string;
  readonly timeframe: Timeframe;
  readonly currentTick: MarketTick | null;
  readonly currentCandle: OhlcvRecord | null;

  submitOrder(request: PlaceOrderInput): OrderSnapshot;
  cancelOrder(orderId: string): OrderSnapshot | null;
  getOpenOrders(): OrderSnapshot[];
  getFills(): TradeFill[];
  getOpenPositions(): OpenPosition[];
  getClosedTrades(): ClosedTrade[];
  getSummary(): TradeSummary;
}

export class StrategyContextImpl implements StrategyContext {
  private currentTickValue: MarketTick | null = null;
  private currentCandleValue: OhlcvRecord | null = null;

  constructor(
    private readonly defaultSymbol: string,
    private readonly timeframeValue: Timeframe,
    private readonly orderBook: OrderBookService,
    private readonly tradeRecorder: TradeRecorderService
  ) {}

  get symbol(): string {
    return this.defaultSymbol;
  }

  get timeframe(): Timeframe {
    return this.timeframeValue;
  }

  get currentTick(): MarketTick | null {
    return this.currentTickValue;
  }

  get currentCandle(): OhlcvRecord | null {
    return this.currentCandleValue;
  }

  setCurrentTick(tick: MarketTick | null) {
    this.currentTickValue = tick;
  }

  setCurrentCandle(candle: OhlcvRecord | null) {
    this.currentCandleValue = candle;
  }

  submitOrder(request: PlaceOrderInput): OrderSnapshot {
    const filledRequest: OrderRequest = {
      ...request,
      symbol: request.symbol ?? this.defaultSymbol,
    } as OrderRequest;
    return this.orderBook.submit(filledRequest);
  }

  cancelOrder(orderId: string): OrderSnapshot | null {
    return this.orderBook.cancel(orderId);
  }

  getOpenOrders(): OrderSnapshot[] {
    return this.orderBook.getOpenOrders();
  }

  getFills(): TradeFill[] {
    return this.tradeRecorder.getFills();
  }

  getOpenPositions(): OpenPosition[] {
    return this.tradeRecorder.getOpenPositions();
  }

  getClosedTrades(): ClosedTrade[] {
    return this.tradeRecorder.getClosedTrades();
  }

  getSummary(): TradeSummary {
    return this.tradeRecorder.getSummary();
  }
}
