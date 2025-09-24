import 'antd/dist/reset.css';
import './styles.css';

import { ConfigProvider } from 'antd';
import zh_CN from 'antd/es/locale/zh_CN';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <ConfigProvider locale={zh_CN}>
      <App />
    </ConfigProvider>
  </StrictMode>
);
