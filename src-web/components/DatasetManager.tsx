import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type JSX,
} from 'react';
import type { DatasetSummary } from '../types';
import { activateDataset, deleteDataset, uploadDataset } from '../api/data';

interface DatasetManagerProps {
  datasets: DatasetSummary[];
  loading: boolean;
  error: string | null;
  selectedDatasetId: string | null;
  onSelectDataset: (datasetId: string | null) => void;
  refreshDatasets: () => Promise<void>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
}

function formatRange(dataset: DatasetSummary): string | null {
  if (!dataset.secondsStart || !dataset.secondsEnd) {
    return null;
  }
  const start = formatDate(dataset.secondsStart);
  const end = formatDate(dataset.secondsEnd);
  return `${start} → ${end}`;
}

function resolveDatasetName(dataset: DatasetSummary): string {
  return dataset.originalName || dataset.filename || dataset.id;
}

function joinClassNames(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}

export default function DatasetManager({
  datasets,
  loading,
  error,
  selectedDatasetId,
  onSelectDataset,
  refreshDatasets,
}: DatasetManagerProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [activateOnUpload, setActivateOnUpload] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingDatasetId, setPendingDatasetId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeDataset = useMemo(
    () => datasets.find((dataset) => dataset.isActive) ?? null,
    [datasets],
  );

  const selectedDataset = useMemo(() => {
    if (!selectedDatasetId) {
      return activeDataset;
    }
    return datasets.find((dataset) => dataset.id === selectedDatasetId) ?? null;
  }, [activeDataset, datasets, selectedDatasetId]);

  const currentSelectionLabel = useMemo(() => {
    if (selectedDatasetId && selectedDataset) {
      return `${resolveDatasetName(selectedDataset)}（临时选择）`;
    }
    if (activeDataset) {
      return `${resolveDatasetName(activeDataset)}（激活）`;
    }
    return '使用默认上传数据';
  }, [activeDataset, selectedDataset, selectedDatasetId]);

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) {
      setUploadError(null);
    }
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (uploading) {
      return;
    }
    if (!selectedFile) {
      setUploadError('请选择要上传的 CSV 文件');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setActionError(null);
    try {
      const dataset = await uploadDataset(selectedFile, {
        note: note.trim() ? note.trim() : undefined,
        activate: activateOnUpload,
      });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setNote('');
      if (activateOnUpload) {
        onSelectDataset(null);
      } else {
        onSelectDataset(dataset.id);
      }
      await refreshDatasets().catch((refreshError) => {
        setActionError((refreshError as Error).message || '刷新数据集失败');
      });
    } catch (err) {
      setUploadError((err as Error).message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleUseDataset = (datasetId: string) => {
    onSelectDataset(datasetId);
    setActionError(null);
  };

  const handleUseActive = () => {
    onSelectDataset(null);
    setActionError(null);
  };

  const handleActivate = async (datasetId: string) => {
    if (pendingDatasetId) {
      return;
    }
    setPendingDatasetId(datasetId);
    setActionError(null);
    try {
      await activateDataset(datasetId);
      onSelectDataset(null);
      await refreshDatasets();
    } catch (err) {
      setActionError((err as Error).message || '激活失败');
    } finally {
      setPendingDatasetId(null);
    }
  };

  const handleDelete = async (datasetId: string) => {
    if (pendingDatasetId) {
      return;
    }
    const confirmDelete = window.confirm('确认删除该数据集？此操作无法恢复。');
    if (!confirmDelete) {
      return;
    }
    setPendingDatasetId(datasetId);
    setActionError(null);
    try {
      await deleteDataset(datasetId);
      if (selectedDatasetId === datasetId) {
        onSelectDataset(null);
      }
      await refreshDatasets();
    } catch (err) {
      setActionError((err as Error).message || '删除失败');
    } finally {
      setPendingDatasetId(null);
    }
  };

  return (
    <div className="dataset-manager">
      <div className="dataset-manager__header">
        <div>
          <h2>数据集管理</h2>
          <p className="dataset-manager__subtitle">当前回测使用：{currentSelectionLabel}</p>
        </div>
        <button
          type="button"
          className="dataset-manager__ghost-button"
          onClick={handleUseActive}
          disabled={!selectedDatasetId}
        >
          使用激活数据集
        </button>
      </div>

      <form className="dataset-manager__upload" onSubmit={handleUpload}>
        <div className="dataset-manager__upload-row">
          <button
            type="button"
            className="dataset-manager__button"
            onClick={handleChooseFile}
            disabled={uploading}
          >
            选择 CSV 文件
          </button>
          <span className="dataset-manager__file-name">
            {selectedFile ? selectedFile.name : '未选择文件'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="dataset-manager__file-input"
            tabIndex={-1}
          />
        </div>
        <div className="dataset-manager__upload-row">
          <input
            type="text"
            placeholder="备注（可选）"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="dataset-manager__input"
            disabled={uploading}
          />
          <label className="dataset-manager__checkbox">
            <input
              type="checkbox"
              checked={activateOnUpload}
              onChange={(event) => setActivateOnUpload(event.target.checked)}
              disabled={uploading}
            />
            <span>上传后立即设为激活</span>
          </label>
          <button
            className="dataset-manager__button dataset-manager__button--primary"
            type="submit"
            disabled={uploading}
          >
            {uploading ? '上传中…' : '上传数据集'}
          </button>
        </div>
        {uploadError ? <div className="dataset-manager__error">{uploadError}</div> : null}
      </form>

      <div className="dataset-manager__list">
        {loading ? (
          <div className="dataset-manager__status">正在加载数据集…</div>
        ) : error ? (
          <div className="dataset-manager__error">{error}</div>
        ) : datasets.length === 0 ? (
          <div className="dataset-manager__status">暂无上传的数据集</div>
        ) : (
          <div className="dataset-manager__grid">
            {datasets.map((dataset) => {
              const isSelected = selectedDatasetId === dataset.id;
              const cardClassName = joinClassNames(
                'dataset-card',
                dataset.isActive && 'dataset-card--active',
                isSelected && 'dataset-card--selected',
              );
              return (
                <article key={dataset.id} className={cardClassName}>
                  <header className="dataset-card__header">
                    <div>
                      <h3 className="dataset-card__title">{resolveDatasetName(dataset)}</h3>
                      <div className="dataset-card__meta">
                        <span>上传于：{formatDate(dataset.uploadedAt)}</span>
                        <span>行数：{dataset.rows.toLocaleString()}</span>
                        {dataset.note ? <span title={dataset.note}>备注：{dataset.note}</span> : null}
                      </div>
                    </div>
                    <div className="dataset-card__tags">
                      {dataset.isActive ? (
                        <span className="dataset-card__tag dataset-card__tag--active">激活</span>
                      ) : null}
                      {isSelected ? (
                        <span className="dataset-card__tag dataset-card__tag--selected">回测使用中</span>
                      ) : null}
                    </div>
                  </header>
                  {formatRange(dataset) ? (
                    <div className="dataset-card__range">时间范围：{formatRange(dataset)}</div>
                  ) : null}
                  <footer className="dataset-card__footer">
                    <div className="dataset-card__actions">
                      <button
                        type="button"
                        className="dataset-card__action"
                        onClick={() => handleUseDataset(dataset.id)}
                        disabled={isSelected || pendingDatasetId !== null}
                      >
                        {isSelected ? '已用于回测' : '用于本次回测'}
                      </button>
                      {!dataset.isActive ? (
                        <button
                          type="button"
                          className="dataset-card__action"
                          onClick={() => handleActivate(dataset.id)}
                          disabled={pendingDatasetId === dataset.id}
                        >
                          {pendingDatasetId === dataset.id ? '激活中…' : '设为激活'}
                        </button>
                      ) : null}
                      {!dataset.isActive ? (
                        <button
                          type="button"
                          className="dataset-card__action dataset-card__action--danger"
                          onClick={() => handleDelete(dataset.id)}
                          disabled={pendingDatasetId === dataset.id}
                        >
                          {pendingDatasetId === dataset.id ? '删除中…' : '删除'}
                        </button>
                      ) : null}
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
        {actionError ? <div className="dataset-manager__error">{actionError}</div> : null}
      </div>
    </div>
  );
}
