import { ChartPanel } from './components/ChartPanel';

export function App() {
  return (
    <div className="grid w-screen h-screen grid-cols-12 gap-2">
      <div className="col-span-3"></div>
      <div className="col-span-9">
        <ChartPanel className="w-full h-[500px]" />
      </div>
    </div>
  );
}

export default App;
