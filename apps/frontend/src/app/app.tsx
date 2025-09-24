import {
  Layout,
  Menu,
  Typography,
  Button,
  Card,
  List,
  Tag,
  Space,
} from 'antd';
import {
  BarChartOutlined,
  DashboardOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content, Footer } = Layout;

const menuItems = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: 'analytics',
    icon: <BarChartOutlined />,
    label: 'Analytics',
  },
  {
    key: 'automation',
    icon: <ThunderboltOutlined />,
    label: 'Automation',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: 'Settings',
  },
];

const strategies = [
  {
    title: 'Mother Bar Reversal',
    description: 'Tracks breakouts and reversals around high-volume mother bars.',
    tags: ['Active', 'Intraday'],
  },
  {
    title: 'Range Compression',
    description: 'Alerts when price consolidates within a mother bar range.',
    tags: ['Monitoring'],
  },
];

export function App() {
  return (
    <Layout className="min-h-screen">
      <Sider breakpoint="lg" collapsedWidth="0">
        <div className="px-4 py-5 text-lg font-semibold text-white">
          Mother Bar
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header className="bg-white px-6 shadow-sm flex items-center justify-between">
          <Typography.Title level={4} className="!m-0">
            Strategy Overview
          </Typography.Title>
          <Space>
            <Button>Import</Button>
            <Button type="primary">New Strategy</Button>
          </Space>
        </Header>
        <Content className="bg-slate-50 p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Today" className="lg:col-span-2">
              <List
                dataSource={strategies}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.title}
                      description={item.description}
                    />
                    <Space>
                      {item.tags.map((tag) => (
                        <Tag key={tag} color="blue">
                          {tag}
                        </Tag>
                      ))}
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
            <Card title="Status">
              <div className="space-y-4">
                <div>
                  <Typography.Text className="text-gray-500">
                    Active Alerts
                  </Typography.Text>
                  <Typography.Title level={3} className="!m-0">
                    8
                  </Typography.Title>
                </div>
                <div>
                  <Typography.Text className="text-gray-500">
                    Watchlist Symbols
                  </Typography.Text>
                  <Typography.Title level={3} className="!m-0">
                    24
                  </Typography.Title>
                </div>
              </div>
            </Card>
          </div>
        </Content>
        <Footer className="text-center text-gray-500">
          Mother Bar Strategy © {new Date().getFullYear()}
        </Footer>
      </Layout>
    </Layout>
  );
}

export default App;
