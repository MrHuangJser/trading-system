import { OrderSide, OrderType } from '../orders/order.types';
import { StrategyInstance } from '../types/strategy';
import { StrategyContext } from './strategy-context';
import { OhlcvRecord } from '../../shared/types/ohlcv';

export function createBullishCloseStrategy(): StrategyInstance {
  const state = {
    longPositionActive: false,
    stopOrderId: null as string | null,
    takeProfitOrderId: null as string | null,
  };

  const cancelProtectionOrders = (context: StrategyContext) => {
    if (state.stopOrderId) {
      context.cancelOrder(state.stopOrderId);
      state.stopOrderId = null;
    }
    if (state.takeProfitOrderId) {
      context.cancelOrder(state.takeProfitOrderId);
      state.takeProfitOrderId = null;
    }
  };

  const hasLongPosition = (context: StrategyContext) =>
    context
      .getOpenPositions()
      .some((position) => position.side === OrderSide.BUY);

  return {
    onInit(context: StrategyContext) {
      state.longPositionActive = hasLongPosition(context);
      if (!state.longPositionActive) {
        cancelProtectionOrders(context);
      }
    },
    onCandle(candle: OhlcvRecord, context: StrategyContext) {
      const currentlyLong = hasLongPosition(context);
      if (state.longPositionActive && !currentlyLong) {
        cancelProtectionOrders(context);
        state.longPositionActive = false;
      }

      if (state.longPositionActive || currentlyLong) {
        state.longPositionActive = true;
        return;
      }

      if (candle.close <= candle.open) {
        return;
      }

      const entryPrice = candle.close;
      const stopPrice = candle.low;
      const takeProfitPrice = entryPrice + 1;

      context.submitOrder({
        type: OrderType.MARKET,
        side: OrderSide.BUY,
        quantity: 1,
      });

      state.takeProfitOrderId = context.submitOrder({
        type: OrderType.LIMIT,
        side: OrderSide.SELL,
        quantity: 1,
        price: takeProfitPrice,
      }).id;

      state.stopOrderId = context.submitOrder({
        type: OrderType.STOP_MARKET,
        side: OrderSide.SELL,
        quantity: 1,
        stopPrice,
      }).id;

      state.longPositionActive = true;
    },
    onComplete(context: StrategyContext) {
      cancelProtectionOrders(context);
    },
  };
}
