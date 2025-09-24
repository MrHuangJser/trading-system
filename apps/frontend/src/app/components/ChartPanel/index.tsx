import classnames from 'classnames';
import { dispose, init, type Chart, type KLineData } from 'klinecharts';
import { memo, useEffect, useRef, type FC } from 'react';

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartPanelProps {
  className?: string;
  data: KLineData[];
}

export const ChartPanel: FC<ChartPanelProps> = memo(({ data, className }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<Chart>(null);

  useEffect(() => {
    const chartDom = chartContainerRef.current;
    if (chartDom) {
      chartInstance.current = init(chartDom, {});
    }
    return () => {
      if (chartDom) {
        dispose(chartDom);
      }
    };
  }, []);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.applyNewData(data, false);
    }
  }, [data]);

  return <div ref={chartContainerRef} className={classnames(className)}></div>;
});
