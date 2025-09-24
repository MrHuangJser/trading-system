import { Button, Select, Upload } from 'antd';
import classNames from 'classnames';
import { FC, memo } from 'react';
import useSWR from 'swr';

export interface DatasetSelectorProps {
  className?: string;
  onSelect: (value: string) => void;
}

const HOST_URL = 'http://localhost:3000/api';

async function getDataSetList() {
  const response = await fetch(`${HOST_URL}/data-manage/dataset-list`);
  const result = await response.json();
  return result.files;
}

export const DatasetSelector: FC<DatasetSelectorProps> = memo(
  ({ className, onSelect }) => {
    const { data, isLoading } = useSWR('dataset-list', getDataSetList);

    return (
      <div className={classNames(className, 'flex flex-col gap-2')}>
        <Upload
          className="w-full"
          action={`${HOST_URL}/data-manage/upload-dataset`}
          accept=".csv"
          showUploadList={false}
        >
          <Button type="primary" className="w-full">
            上传数据集
          </Button>
        </Upload>
        <Select loading={isLoading} onChange={onSelect} className="w-full">
          {data?.map((item: string) => (
            <Select.Option key={item} value={item}>
              {item}
            </Select.Option>
          ))}
        </Select>
      </div>
    );
  }
);
