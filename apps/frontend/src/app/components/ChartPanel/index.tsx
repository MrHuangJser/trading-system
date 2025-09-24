import classnames from 'classnames';
import { dispose, init, type Chart } from 'klinecharts';
import { omit } from 'lodash';
import { memo, useEffect, useRef, type FC, type HTMLAttributes } from 'react';

export type ChartPanelProps = HTMLAttributes<HTMLDivElement>;

export const ChartPanel: FC<ChartPanelProps> = memo(({ ...props }) => {
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

  return (
    <div
      ref={chartContainerRef}
      className={classnames('w-full h-full', props.className)}
      {...omit(props, 'className')}
    ></div>
  );
});
