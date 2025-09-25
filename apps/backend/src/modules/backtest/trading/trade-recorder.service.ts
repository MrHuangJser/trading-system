import { Injectable } from '@nestjs/common';
import { OrderSide, OrderSnapshot, OrderStatus } from '../orders/order.types';
import {
  ClosedTrade,
  OpenPosition,
  TradeFill,
  TradeSummary,
} from './trade.types';

@Injectable()
export class TradeRecorderService {
  private fills: TradeFill[] = [];
  private closedTrades: ClosedTrade[] = [];
  private openPositions = new Map<string, OpenPosition>();

  reset() {
    this.fills = [];
    this.closedTrades = [];
    this.openPositions.clear();
  }

  recordFill(order: OrderSnapshot) {
    if (order.status !== OrderStatus.FILLED) {
      return;
    }

    const fill: TradeFill = {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      price: order.fills[0]?.price ?? order.price ?? 0,
      quantity: order.quantity,
      timestamp: order.fills[0]?.timestamp ?? order.updatedAt,
    };

    this.fills.push(fill);
    this.updatePositions(fill);
  }

  getFills(): TradeFill[] {
    return [...this.fills];
  }

  getClosedTrades(): ClosedTrade[] {
    return [...this.closedTrades];
  }

  getOpenPositions(): OpenPosition[] {
    return Array.from(this.openPositions.values()).map((position) => ({
      ...position,
      fills: [...position.fills],
    }));
  }

  getSummary(): TradeSummary {
    const totalPnl = this.closedTrades.reduce(
      (acc, trade) => acc + trade.pnl,
      0
    );
    const winTrades = this.closedTrades.filter((trade) => trade.pnl > 0).length;
    const lossTrades = this.closedTrades.filter(
      (trade) => trade.pnl < 0
    ).length;
    return {
      totalTrades: this.closedTrades.length,
      totalPnl,
      winTrades,
      lossTrades,
    };
  }

  private updatePositions(fill: TradeFill) {
    const oppositeKey = this.getPositionKey(
      fill.symbol,
      fill.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY
    );

    const oppositePosition = this.openPositions.get(oppositeKey);
    if (oppositePosition) {
      const { closedTrade, remainingExitQuantity } = this.closePosition(
        oppositeKey,
        oppositePosition,
        fill
      );
      if (closedTrade) {
        this.closedTrades.push(closedTrade);
      }

      if (remainingExitQuantity > 0) {
        const remainderFill: TradeFill = {
          ...fill,
          quantity: remainingExitQuantity,
        };
        this.openOrIncreasePosition(remainderFill);
      }
      return;
    }

    this.openOrIncreasePosition(fill);
  }

  private openOrIncreasePosition(fill: TradeFill) {
    const key = this.getPositionKey(fill.symbol, fill.side);
    const position = this.openPositions.get(key);
    if (!position) {
      this.openPositions.set(key, {
        symbol: fill.symbol,
        side: fill.side,
        quantity: fill.quantity,
        avgPrice: fill.price,
        entryTimestamp: fill.timestamp,
        fills: [fill],
      });
      return;
    }

    const newQuantity = position.quantity + fill.quantity;
    const newAvgPrice =
      (position.avgPrice * position.quantity + fill.price * fill.quantity) /
      newQuantity;

    position.quantity = newQuantity;
    position.avgPrice = newAvgPrice;
    position.fills.push(fill);
  }

  private closePosition(
    positionKey: string,
    position: OpenPosition,
    exitFill: TradeFill
  ): { closedTrade: ClosedTrade | null; remainingExitQuantity: number } {
    const quantityToClose = Math.min(position.quantity, exitFill.quantity);
    if (quantityToClose <= 0) {
      return { closedTrade: null, remainingExitQuantity: exitFill.quantity };
    }

    const entryPrice = position.avgPrice;
    const exitPrice = exitFill.price;
    const pnl = this.calculatePnl(
      position.side,
      entryPrice,
      exitPrice,
      quantityToClose
    );

    const closedTrade: ClosedTrade = {
      symbol: position.symbol,
      direction: position.side,
      entryPrice,
      exitPrice,
      quantity: quantityToClose,
      entryTimestamp: position.entryTimestamp,
      exitTimestamp: exitFill.timestamp,
      pnl,
    };

    const remainingPositionQuantity = position.quantity - quantityToClose;
    if (remainingPositionQuantity > 0) {
      position.quantity = remainingPositionQuantity;
    } else {
      this.openPositions.delete(positionKey);
    }

    const remainingExitQuantity = exitFill.quantity - quantityToClose;

    return { closedTrade, remainingExitQuantity };
  }

  private calculatePnl(
    direction: OrderSide,
    entryPrice: number,
    exitPrice: number,
    quantity: number
  ) {
    const diff = exitPrice - entryPrice;
    return direction === OrderSide.BUY ? diff * quantity : -diff * quantity;
  }

  private getPositionKey(symbol: string, side: OrderSide) {
    return `${symbol}:${side}`;
  }
}
